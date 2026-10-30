import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminHandler,
  ApiError,
  checkDb,
  jsonBody,
} from "@/lib/ingestion/auth";
import { reviewSchema } from "@/lib/ingestion/contracts";
import {
  indexVersion,
  runOcr,
  versionFor,
  event,
} from "@/lib/ingestion/service";
export const runtime = "nodejs";
export const maxDuration = 60;
export const GET = adminHandler(async (request, { db }) => {
  const url = new URL(request.url);
  const id = z.uuid().safeParse(url.searchParams.get("versionId"));
  if (!id.success) throw new ApiError(400, "Versione richiesta.");
  const ordinal = Math.max(
    0,
    Math.floor(Number(url.searchParams.get("ordinal")) || 0),
  );
  const { data, error, count } = await db
    .from("material_segments")
    .select("ordinal,page,section,text,kind,reviewed", { count: "exact" })
    .eq("version_id", id.data)
    .order("ordinal")
    .range(ordinal, ordinal);
  checkDb(error, "Segmenti non disponibili.");
  return NextResponse.json({ segment: data?.[0] ?? null, count });
});
export const POST = adminHandler(async (request, context) => {
  const input = reviewSchema.safeParse(await jsonBody(request));
  if (!input.success) throw new ApiError(400, "Revisione non valida.");
  const { db, user } = context;
  const v = await versionFor(db, input.data.versionId);
  const { action } = input.data;
  if (action === "consent") {
    if (typeof input.data.externalConsent !== "boolean")
      throw new ApiError(400, "Consenso esplicito richiesto.");
    const { error } = await db
      .from("materials")
      .update({ external_consent: input.data.externalConsent })
      .eq("id", v.material_id);
    checkDb(error, "Consenso non salvato.");
    if (!input.data.externalConsent) {
      const { error } = await db
        .from("material_chunks")
        .update({ embedding: null, embedding_model: null })
        .eq("material_id", v.material_id);
      checkDb(error, "Rimozione embeddings non riuscita.");
      await db
        .from("material_versions")
        .update({ embedding_model: null })
        .eq("material_id", v.material_id);
    }
    await event(
      db,
      v.id,
      user.id,
      input.data.externalConsent
        ? "Consenso esterno abilitato esplicitamente"
        : "Consenso esterno revocato ed embeddings rimossi",
    );
    return NextResponse.json({ saved: true });
  }
  if (action === "classify") {
    if (!input.data.area) throw new ApiError(400, "Seleziona un’area.");
    const { error } = await db
      .from("materials")
      .update({ area: input.data.area })
      .eq("id", v.material_id);
    checkDb(error, "Classificazione non salvata.");
    await event(
      db,
      v.id,
      user.id,
      `Classificazione corretta manualmente: ${input.data.area}`,
    );
    return NextResponse.json({ saved: true });
  }
  if (action === "retry") {
    if (!["error", "processing"].includes(v.status))
      throw new ApiError(409, "Non è un lavoro in errore.");
    const { data } = await db
      .from("material_versions")
      .select("lease_until")
      .eq("id", v.id)
      .single();
    if (data?.lease_until && Date.parse(data.lease_until) > Date.now())
      throw new ApiError(
        409,
        "Lavoro ancora in corso: attendi la scadenza del lease.",
      );
    await db
      .from("material_versions")
      .update({
        status: "uploaded",
        error_message: null,
        attempts: 0,
        lease_token: null,
        lease_until: null,
      })
      .eq("id", v.id);
    return NextResponse.json({ retry: true });
  }
  if (action === "ocr") {
    try {
      return NextResponse.json(await runOcr(context, v.id));
    } catch (error) {
      await event(
        db,
        v.id,
        user.id,
        "OCR non completato: trascrizioni precedenti conservate.",
        "error",
      );
      throw error;
    }
  }
  if (action === "edit") {
    if (!["needs_ocr", "review"].includes(v.status) || !input.data.segment)
      throw new ApiError(409, "Modifica consentita prima dell’indicizzazione.");
    const { error } = await db
      .from("material_segments")
      .update({ text: input.data.segment.text, reviewed: true })
      .eq("version_id", v.id)
      .eq("ordinal", input.data.segment.ordinal);
    checkDb(error, "Trascrizione non salvata.");
    return NextResponse.json({ saved: true });
  }
  if (action === "approve") {
    if (!["needs_ocr", "review", "indexing"].includes(v.status))
      throw new ApiError(409, "Estrazione non pronta per approvazione.");
    const { error: approvalError } = await db.rpc(
      "approve_material_extraction",
      { job_id: v.id },
    );
    if (approvalError)
      throw new ApiError(
        409,
        "Richiesti testo indicizzabile e conferma di tutte le pagine OCR o con testo scarso.",
      );
    try {
      return NextResponse.json(await indexVersion(context, v.id, false));
    } catch (error) {
      await event(
        db,
        v.id,
        user.id,
        "Indicizzazione full-text non completata: riprendi dopo la correzione.",
        "error",
      );
      throw error;
    }
  }
  throw new ApiError(400, "Azione non supportata.");
});
