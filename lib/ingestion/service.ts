import { limitedJson } from "./net";
import "server-only";
import { z } from "zod";
import {
  BUCKET,
  MAX_FILE_BYTES,
  segmentSchema,
  type MaterialVersion,
  type Segment,
} from "./contracts";
import {
  chunkSegments,
  classify,
  extractBatch,
  hashBytes,
  validateFile,
} from "./extract";
import { ApiError, checkDb, type AdminContext } from "./auth";
export async function versionFor(db: AdminContext["db"], id: string) {
  const { data, error } = await db
    .from("material_versions")
    .select("*,materials(*)")
    .eq("id", id)
    .single();
  if (error || !data)
    throw new ApiError(404, "Versione non trovata nel tuo archivio.");
  return data as MaterialVersion;
}
export async function originalBytes(context: AdminContext, v: MaterialVersion) {
  const { data, error } = await context.db.storage
    .from(BUCKET)
    .download(v.storage_path);
  if (error || !data)
    throw new ApiError(
      409,
      "Originale assente o upload incompleto. Riprova il caricamento.",
    );
  if (data.size !== v.byte_size || data.size > MAX_FILE_BYTES)
    throw new ApiError(
      400,
      "Dimensione originale diversa da quella registrata.",
    );
  const bytes = new Uint8Array(await data.arrayBuffer());
  validateFile(bytes, v.mime_type);
  return bytes;
}
export async function event(
  db: AdminContext["db"],
  id: string,
  userId: string,
  message: string,
  level = "info",
) {
  await db
    .from("ingestion_events")
    .insert({ user_id: userId, version_id: id, message, level });
}
export async function processVersion(context: AdminContext, id: string) {
  const { db, user } = context;
  const { data, error } = await db.rpc("claim_material_job", { job_id: id });
  checkDb(error, "Impossibile acquisire il lavoro.");
  const v = (data as (MaterialVersion & { lease_token: string })[] | null)?.[0];
  if (!v)
    throw new ApiError(
      409,
      "Lavoro già in corso o non elaborabile. Riprendi dopo la scadenza del lease o usa Riprova.",
    );
  try {
    const bytes = await originalBytes(context, v);
    const hash = hashBytes(bytes);
    const { data: duplicate, error: hashError } = await db.rpc(
      "register_material_hash",
      { job_id: id, token: v.lease_token, content_hash: hash },
    );
    checkDb(hashError, "Impossibile registrare l’hash.");
    if (duplicate) {
      await db.storage.from(BUCKET).remove([v.storage_path]);
      await event(
        db,
        id,
        user.id,
        "Duplicato rilevato tramite SHA-256; copia ridondante rimossa.",
      );
      return { status: "duplicate", duplicateOf: duplicate, more: false };
    }
    const batch = await extractBatch(bytes, v.mime_type, v.cursor);
    const suggested = classify(
      v.file_name,
      batch.segments.map((s) => s.text).join("\n"),
    );
    const { error: batchError } = await db.rpc("commit_material_batch", {
      job_id: id,
      token: v.lease_token,
      segments: batch.segments,
      next_cursor: batch.nextCursor,
      complete: batch.done,
      total_pages: batch.pageCount,
      batch_warnings: batch.warnings,
      extra_metadata: {
        ...batch.metadata,
        ...(v.cursor === 0 ? { classification: suggested } : {}),
      },
    });
    checkDb(batchError, "Impossibile salvare il lotto estratto.");

    if (v.cursor === 0) {
      await db
        .from("materials")
        .update({ area: suggested.area })
        .eq("id", v.material_id)
        .is("area", null);
    }
    return {
      status: batch.done ? "review" : "uploaded",
      more: !batch.done,
      cursor: batch.nextCursor,
      warnings: batch.warnings,
    };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error &&
            /PDF|DOCX|Pagina|Dimensione|limite|password|Invalid PDF|worker/i.test(
              error.message,
            )
          ? error.message.slice(0, 300)
          : "Estrazione fallita: file corrotto, protetto o formato non supportato.";
    await db
      .from("material_versions")
      .update({
        status: "error",
        error_message: message,
        lease_until: null,
        lease_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("lease_token", v.lease_token);
    await event(db, id, user.id, message, "error");
    throw new ApiError(422, message);
  }
}
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!process.env.AI_API_KEY)
    throw new ApiError(
      503,
      "Chiave embeddings non configurata; disponibile indicizzazione full-text.",
    );
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      dimensions: 1536,
      input: texts,
    }),
  });
  if (!response.ok)
    throw new ApiError(502, "Provider embeddings non disponibile.");
  const result = z
    .object({
      data: z.array(
        z.object({
          index: z.number().int(),
          embedding: z.array(z.number().finite()).length(1536),
        }),
      ),
    })
    .parse(await limitedJson(response, 2000000));
  const ordered = result.data.sort((a, b) => a.index - b.index);
  if (ordered.length !== texts.length || ordered.some((r, i) => r.index !== i))
    throw new ApiError(502, "Risposta embeddings incompleta.");
  if (ordered.some((r) => !r.embedding.some((v) => v !== 0)))
    throw new ApiError(502, "Embedding nullo non valido.");
  return ordered.map((r) => r.embedding);
}
export async function indexVersion(
  context: AdminContext,
  id: string,
  semantic: boolean,
) {
  const { db, user } = context;
  const version = await versionFor(db, id);
  if (version.status !== "indexing" || !version.materials)
    throw new ApiError(409, "Approva prima l’estrazione.");
  const segments = await allSegments(context, id);
  const chunks = chunkSegments(segments);
  if (!chunks.length) throw new ApiError(400, "Nessun testo indicizzabile.");
  if (chunks.length > 12000)
    throw new ApiError(400, "Documento troppo lungo: suddividilo in volumi.");
  // FTS is committed atomically first, never leave a partial new index on provider failure.
  const { error: indexError } = await db.rpc("replace_material_index", {
    job_id: id,
    chunks,
    model_name: null,
  });
  checkDb(indexError, "Indicizzazione non riuscita.");
  await event(db, id, user.id, "Indice full-text disponibile.");
  if (semantic) {
    if (!version.materials.external_consent)
      throw new ApiError(
        400,
        "Indice full-text pronto. Manca il consenso all’elaborazione esterna per gli embeddings.",
      );
  }
  return {
    status: "indexed",
    chunks: chunks.length,
    semanticPending: semantic && Boolean(process.env.AI_API_KEY),
    semanticConfigured: Boolean(process.env.AI_API_KEY),
  };
}
export async function embedVersion(context: AdminContext, id: string) {
  const v = await versionFor(context.db, id);
  if (v.status !== "indexed" || !v.materials?.external_consent)
    throw new ApiError(409, "Richiesti indice full-text e consenso esterno.");
  const { data, error } = await context.db
    .from("material_chunks")
    .select("id,content")
    .eq("version_id", id)
    .is("embedding", null)
    .order("ordinal")
    .limit(24);
  checkDb(error, "Indice non disponibile.");
  if (!data?.length) return { more: false, embedded: 0 };
  const vectors = await embedTexts(data.map((c) => String(c.content)));
  for (let i = 0; i < data.length; i++) {
    const { error } = await context.db
      .from("material_chunks")
      .update({
        embedding: JSON.stringify(vectors[i]),
        embedding_model: "text-embedding-3-small",
      })
      .eq("id", data[i].id);
    checkDb(
      error,
      "Salvataggio embedding non riuscito; il lotto è riprendibile.",
    );
  }
  const { count, error: countError } = await context.db
    .from("material_chunks")
    .select("id", { count: "exact", head: true })
    .eq("version_id", id)
    .is("embedding", null);
  checkDb(
    countError,
    "Conteggio embeddings non disponibile: riprendi il lotto.",
  );
  if (count === 0)
    await context.db
      .from("material_versions")
      .update({ embedding_model: "text-embedding-3-small" })
      .eq("id", id);
  return { more: (count ?? 0) > 0, embedded: data.length };
}
export async function runOcr(context: AdminContext, id: string) {
  const version = await versionFor(context.db, id);
  if (!["needs_ocr", "review"].includes(version.status))
    throw new ApiError(409, "OCR disponibile solo prima dell’approvazione.");
  if (!version.materials?.external_consent)
    throw new ApiError(
      400,
      "Abilita il consenso all’elaborazione esterna prima dell’OCR.",
    );
  if (!process.env.OCR_SERVICE_URL || !process.env.OCR_SERVICE_KEY)
    throw new ApiError(503, "Servizio OCR opzionale non configurato.");
  const endpoint = new URL(process.env.OCR_SERVICE_URL);
  if (endpoint.protocol !== "https:")
    throw new ApiError(503, "OCR richiede HTTPS.");
  const { data } = await context.db
    .from("material_segments")
    .select("ordinal,page,text")
    .eq("version_id", id)
    .eq("reviewed", false)
    .order("ordinal");
  const pages = (data ?? [])
    .filter((s) => s.page && String(s.text).replace(/\s/g, "").length < 25)
    .slice(0, 5)
    .map((s) => Number(s.page));
  if (!pages.length)
    throw new ApiError(400, "Nessuna pagina scansionata da elaborare.");
  const bytes = await originalBytes(context, version);
  const form = new FormData();
  form.set(
    "file",
    new Blob([new Uint8Array(bytes)], { type: version.mime_type }),
    "original.pdf",
  );
  form.set("pages", JSON.stringify(pages));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OCR_SERVICE_KEY}` },
    body: form,
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new ApiError(502, "Servizio OCR non disponibile.");
  const output = z
    .object({
      pages: z
        .array(
          z.object({
            page: z.number().int().positive(),
            text: z.string().max(100000),
          }),
        )
        .max(5),
    })
    .parse(await limitedJson(response, 650000));
  if (
    output.pages.length !== pages.length ||
    new Set(output.pages.map((p) => p.page)).size !== pages.length ||
    output.pages.some((p) => !pages.includes(p.page))
  )
    throw new ApiError(502, "Risposta OCR incompleta o pagine non richieste.");
  for (const page of output.pages) {
    const { error } = await context.db
      .from("material_segments")
      .update({ text: page.text, kind: "ocr", reviewed: false })
      .eq("version_id", id)
      .eq("page", page.page);
    checkDb(error, "Salvataggio OCR non riuscito.");
  }
  await context.db
    .from("material_versions")
    .update({
      status: "review",
      warnings: [
        ...version.warnings,
        "OCR automatico: revisione manuale obbligatoria prima dell’indice.",
      ],
    })
    .eq("id", id);
  await event(
    context.db,
    id,
    context.user.id,
    "OCR ricevuto: revisione delle trascrizioni richiesta.",
    "warning",
  );
  return { pages, reviewRequired: true };
}
export async function allSegments(
  context: AdminContext,
  id: string,
): Promise<Segment[]> {
  const output: Segment[] = [];
  let characters = 0;
  for (let offset = 0; offset < 15000; offset += 500) {
    const { data, error } = await context.db
      .from("material_segments")
      .select("ordinal,page,section,text,kind")
      .eq("version_id", id)
      .order("ordinal")
      .range(offset, offset + 499);
    checkDb(error, "Lettura segmenti fallita.");
    const batch = z.array(segmentSchema).parse(data);
    characters += batch.reduce((total, s) => total + s.text.length, 0);
    if (characters > 8000000)
      throw new ApiError(
        413,
        "Testo oltre 8 milioni di caratteri: suddividi il documento.",
      );
    output.push(...batch);
    if (batch.length < 500) return output;
  }
  throw new ApiError(413, "Troppi segmenti.");
}
