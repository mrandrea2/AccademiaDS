import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError, checkDb, type AdminContext } from "./auth";
import { seal, unseal } from "./crypto";
import {
  DRIVE_FOLDER_ID,
  DOCX_MIME,
  PDF_MIME,
  MAX_FILE_BYTES,
  BUCKET,
} from "./contracts";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const tokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
  scope: z.string(),
});
const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  modifiedTime: z.string(),
  version: z.string().default(""),
  size: z.string().optional(),
  parents: z.array(z.string()).optional(),
  trashed: z.boolean().optional(),
  md5Checksum: z.string().optional(),
});
export type DriveFile = z.infer<typeof fileSchema>;
export function driveConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.DRIVE_TOKEN_ENCRYPTION_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.APP_URL,
  );
}
function service() {
  if (!driveConfigured())
    throw new ApiError(
      503,
      "Google OAuth non configurato: nessuna sincronizzazione attiva.",
    );
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function driveConnected(userId: string) {
  if (!driveConfigured()) return false;
  const { data, error } = await service().rpc("drive_connection_get", {
    owner_id: userId,
  });
  return !error && Boolean(data);
}
export function appUrl() {
  const url = new URL(process.env.APP_URL ?? "");
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && url.hostname === "localhost")
  )
    throw new ApiError(
      503,
      "APP_URL deve essere HTTPS (localhost ammesso in sviluppo).",
    );
  return url.origin;
}
export function createAuthorization(userId: string) {
  if (!driveConfigured())
    throw new ApiError(
      503,
      "Configura Google OAuth e la cifratura prima di connettere Drive.",
    );
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${appUrl()}/api/drive/callback`,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return {
    url: url.toString(),
    cookie: seal({ state, verifier, userId, createdAt: Date.now() }),
  };
}
export function validateOAuthState(
  cookie: string,
  state: string,
  userId: string,
) {
  const record = z
    .object({
      state: z.string(),
      verifier: z.string(),
      userId: z.string(),
      createdAt: z.number(),
    })
    .parse(unseal(cookie));
  if (
    record.state !== state ||
    record.userId !== userId ||
    Date.now() - record.createdAt > 600000 ||
    record.createdAt > Date.now() + 1000
  )
    throw new ApiError(400, "Stato OAuth scaduto o non valido.");
  return record;
}
async function tokenRequest(parameters: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...parameters,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new ApiError(
      401,
      "Google ha rifiutato l’autorizzazione. Riconnetti Drive.",
    );
  return z
    .object({
      access_token: z.string(),
      expires_in: z.number(),
      refresh_token: z.string().optional(),
      scope: z.string().optional(),
    })
    .parse(await response.json());
}
export async function exchangeCode(
  userId: string,
  code: string,
  verifier: string,
) {
  const response = await tokenRequest({
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: `${appUrl()}/api/drive/callback`,
  });
  if (
    !response.refresh_token ||
    !response.scope?.split(" ").includes(DRIVE_SCOPE)
  )
    throw new ApiError(
      401,
      "Consenso Google insufficiente o refresh token assente. Riconnetti con consenso offline.",
    );
  const tokens = {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: Date.now() + response.expires_in * 1000,
    scope: response.scope,
  };
  const { error } = await service().rpc("drive_connection_set", {
    owner_id: userId,
    tokens: seal(tokens),
    granted_scopes: [DRIVE_SCOPE],
  });
  checkDb(error, "Impossibile conservare la connessione cifrata.");
}
async function accessToken(userId: string) {
  const client = service();
  const { data, error } = await client.rpc("drive_connection_get", {
    owner_id: userId,
  });
  if (error || !data)
    throw new ApiError(
      401,
      "Drive non connesso: autorizza prima il tuo account Google.",
    );
  let tokens;
  try {
    tokens = tokensSchema.parse(unseal(data));
  } catch {
    throw new ApiError(
      503,
      "Connessione cifrata non leggibile: riconnetti Drive.",
    );
  }
  if (tokens.expires_at < Date.now() + 60000) {
    const fresh = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    });
    tokens = {
      ...tokens,
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token ?? tokens.refresh_token,
      expires_at: Date.now() + fresh.expires_in * 1000,
    };
    const { error: saveError } = await client.rpc("drive_connection_set", {
      owner_id: userId,
      tokens: seal(tokens),
      granted_scopes: [DRIVE_SCOPE],
    });
    checkDb(saveError, "Refresh token non salvato.");
  }
  return tokens.access_token;
}
async function google(userId: string, path: string) {
  const token = await accessToken(userId);
  const url = new URL(path, "https://www.googleapis.com");
  if (
    url.origin !== "https://www.googleapis.com" ||
    !url.pathname.startsWith("/drive/v3/")
  )
    throw new ApiError(400, "Destinazione Google non consentita.");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30000),
    redirect: "error",
  });
  if (!response.ok)
    throw new ApiError(
      response.status === 403 ? 403 : 502,
      "Drive non accessibile. Controlla consenso, accesso alla cartella e quota Google.",
    );
  return response;
}
export function differential(
  files: DriveFile[],
  known: Map<string, { remote_version: string; status: string }>,
) {
  return files.map((file) => ({
    file,
    action: ![PDF_MIME, DOCX_MIME].includes(file.mimeType)
      ? "unsupported"
      : known.get(file.id)?.remote_version ===
            `${file.version}:${file.modifiedTime}` &&
          known.get(file.id)?.status === "imported"
        ? "unchanged"
        : "pending",
  }));
}
export async function discoverDrive(context: AdminContext) {
  const { db, user } = context;
  const folder = fileSchema
    .pick({ id: true, name: true, mimeType: true })
    .parse(
      await (
        await google(
          user.id,
          `/drive/v3/files/${DRIVE_FOLDER_ID}?fields=id,name,mimeType&supportsAllDrives=true`,
        )
      ).json(),
    );
  if (folder.mimeType !== "application/vnd.google-apps.folder")
    throw new ApiError(400, "La destinazione non è una cartella Drive.");
  // An interrupted old discovery must not block the user indefinitely.
  await db
    .from("drive_sync_runs")
    .update({
      status: "error",
      finished_at: new Date().toISOString(),
      errors: ["Sincronizzazione interrotta: ripetere la scoperta."],
    })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 3600000).toISOString());
  const { data: run, error } = await db
    .from("drive_sync_runs")
    .insert({ user_id: user.id, status: "running" })
    .select()
    .single();
  if (error || !run)
    throw new ApiError(
      409,
      "Esiste già una sincronizzazione in corso: riprendila o annullala.",
    );
  try {
    const files: DriveFile[] = [];
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        q: `'${DRIVE_FOLDER_ID}' in parents and trashed = false`,
        fields:
          "nextPageToken,files(id,name,mimeType,modifiedTime,version,size,parents)",
        pageSize: "100",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        ...(pageToken ? { pageToken } : {}),
      });
      const page = z
        .object({
          nextPageToken: z.string().optional(),
          files: z.array(fileSchema),
        })
        .parse(
          await (await google(user.id, `/drive/v3/files?${params}`)).json(),
        );
      files.push(...page.files);
      pageToken = page.nextPageToken ?? "";
      if (files.length > 1000)
        throw new ApiError(
          413,
          "Cartella oltre il limite di 1.000 file per sincronizzazione.",
        );
    } while (pageToken);
    const { data: items } = await db
      .from("drive_items")
      .select("file_id,remote_version,status,material_id");
    const known = new Map(
      (items ?? []).map((i) => [
        String(i.file_id),
        { remote_version: String(i.remote_version), status: String(i.status) },
      ]),
    );
    const plan = differential(files, known);
    for (const { file, action } of plan) {
      const { error } = await db.from("drive_items").upsert(
        {
          user_id: user.id,
          file_id: file.id,
          name: file.name,
          modified_time: file.modifiedTime,
          remote_version: `${file.version}:${file.modifiedTime}`,
          mime_type: file.mimeType,
          status: action === "unchanged" ? "imported" : action,
          material_id:
            items?.find((i) => i.file_id === file.id)?.material_id ?? null,
          last_seen_run: run.id,
          last_error:
            action === "unsupported"
              ? "Formato non importato (incluse sorgenti JSX): nessun codice eseguito."
              : null,
        },
        { onConflict: "user_id,file_id" },
      );
      checkDb(error, "Inventario Drive non salvato.");
    }
    await db
      .from("drive_items")
      .update({
        status: "remote_removed",
        last_error:
          "Assente dalla cartella nell’ultima scoperta completa; copia privata conservata.",
      })
      .neq("last_seen_run", run.id);
    const { error: updateError } = await db
      .from("drive_sync_runs")
      .update({
        discovered: files.length,
        skipped: plan.filter((p) => p.action !== "pending").length,
      })
      .eq("id", run.id);
    checkDb(updateError, "Stato sincronizzazione non salvato.");
    return {
      runId: run.id,
      discovered: files.length,
      pending: plan.filter((p) => p.action === "pending").length,
      folder: folder.name,
    };
  } catch (error) {
    await db
      .from("drive_sync_runs")
      .update({
        status: "error",
        errors: ["Inventario fallito: nessuna rimozione locale applicata."],
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    throw error;
  }
}
async function boundedBytes(response: Response) {
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_FILE_BYTES)
    throw new ApiError(413, "File Drive oltre 50 MiB.");
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(502, "Download Drive vuoto.");
  let length = 0;
  const blocks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_FILE_BYTES)
        throw new ApiError(413, "File Drive oltre 50 MiB.");
      blocks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const block of blocks) {
    bytes.set(block, offset);
    offset += block.length;
  }
  return bytes;
}
export async function nextDriveFile(
  context: AdminContext,
  runId: string,
  externalConsent: boolean,
) {
  const { db, user } = context;
  const { data: run } = await db
    .from("drive_sync_runs")
    .select("*")
    .eq("id", runId)
    .eq("status", "running")
    .single();
  if (!run) throw new ApiError(409, "Sincronizzazione non attiva.");
  await db
    .from("drive_items")
    .update({ status: "pending" })
    .eq("last_seen_run", runId)
    .eq("status", "processing")
    .lt("lease_until", new Date().toISOString());
  const { data: pending, error: pendingError } = await db
    .from("drive_items")
    .select("*")
    .eq("last_seen_run", runId)
    .eq("status", "pending")
    .order("file_id")
    .limit(1);
  checkDb(pendingError, "Coda Drive non disponibile.");
  const item = pending?.[0];
  if (!item) {
    const { count } = await db
      .from("drive_items")
      .select("file_id", { count: "exact", head: true })
      .eq("last_seen_run", runId)
      .eq("status", "processing");
    if (count) throw new ApiError(409, "Un download è già in corso.");
    const { data: errors } = await db
      .from("drive_items")
      .select("name,last_error")
      .eq("last_seen_run", runId)
      .eq("status", "error");
    await db
      .from("drive_sync_runs")
      .update({
        status: "complete",
        finished_at: new Date().toISOString(),
        errors: errors ?? [],
      })
      .eq("id", runId);
    return { more: false, complete: true };
  }
  const { data: claimed } = await db
    .from("drive_items")
    .update({
      status: "processing",
      lease_until: new Date(Date.now() + 120000).toISOString(),
    })
    .eq("file_id", item.file_id)
    .eq("status", "pending")
    .select();
  if (!claimed?.length)
    throw new ApiError(409, "File già acquisito da un’altra richiesta.");
  try {
    const meta = fileSchema.parse(
      await (
        await google(
          user.id,
          `/drive/v3/files/${encodeURIComponent(item.file_id)}?fields=id,name,mimeType,modifiedTime,version,size,parents,trashed,md5Checksum&supportsAllDrives=true`,
        )
      ).json(),
    );
    if (
      !meta.parents?.includes(DRIVE_FOLDER_ID) ||
      meta.trashed ||
      ![PDF_MIME, DOCX_MIME].includes(meta.mimeType) ||
      `${meta.version}:${meta.modifiedTime}` !== item.remote_version
    )
      throw new ApiError(
        409,
        "File spostato, cambiato o non supportato: ripeti la scoperta.",
      );
    if (Number(meta.size) > MAX_FILE_BYTES)
      throw new ApiError(
        413,
        "File Drive oltre 50 MiB: suddividilo prima dell’import.",
      );
    const bytes = await boundedBytes(
      await google(
        user.id,
        `/drive/v3/files/${encodeURIComponent(meta.id)}?alt=media&supportsAllDrives=true`,
      ),
    );
    if (meta.size && bytes.length !== Number(meta.size))
      throw new ApiError(409, "Dimensione Drive cambiata durante il download.");
    const after = fileSchema.parse(
      await (
        await google(
          user.id,
          `/drive/v3/files/${encodeURIComponent(meta.id)}?fields=id,name,mimeType,modifiedTime,version,size,parents,trashed&supportsAllDrives=true`,
        )
      ).json(),
    );
    if (
      after.version !== meta.version ||
      after.modifiedTime !== meta.modifiedTime ||
      !after.parents?.includes(DRIVE_FOLDER_ID) ||
      after.trashed
    )
      throw new ApiError(
        409,
        "File cambiato durante il download: ripeti la scoperta.",
      );
    if (
      meta.md5Checksum &&
      createHash("md5").update(bytes).digest("hex") !== meta.md5Checksum
    )
      throw new ApiError(
        409,
        "Checksum Google non corrispondente: nessun originale acquisito.",
      );
    const { data: version, error } = await db.rpc("reserve_material", {
      file_title: meta.name.slice(0, 180),
      file_name: meta.name,
      mime: meta.mimeType,
      bytes: bytes.length,
      external_allowed: externalConsent,
      parent_id: item.material_id ?? null,
      remote_id: meta.id,
    });
    checkDb(error, "Versione Drive non riservata.");
    const { error: metadataError } = await db
      .from("material_versions")
      .update({
        metadata: {
          drive: {
            fileId: meta.id,
            remoteVersion: meta.version,
            modifiedTime: meta.modifiedTime,
            md5Checksum: meta.md5Checksum ?? null,
            folderId: DRIVE_FOLDER_ID,
          },
        },
      })
      .eq("id", version.id);
    checkDb(metadataError, "Metadati della versione Drive non salvati.");
    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(version.storage_path, bytes, {
        contentType: meta.mimeType,
        upsert: false,
      });
    checkDb(uploadError, "Originale Drive non salvato.");
    const { error: recordError } = await db.rpc("record_drive_import", {
      run_id: runId,
      remote_file_id: meta.id,
      parent_id: version.material_id,
    });
    checkDb(
      recordError,
      "Import acquisito ma riepilogo non aggiornato: verifica la sincronizzazione.",
    );
    return { more: true, file: meta.name, versionId: version.id };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Download non riuscito. Riprova con una nuova sincronizzazione.";
    await db
      .from("drive_items")
      .update({ status: "error", last_error: message, lease_until: null })
      .eq("file_id", item.file_id);
    return { more: true, error: message, file: item.name };
  }
}
export async function disconnectDrive(userId: string) {
  const client = service();
  const { data } = await client.rpc("drive_connection_get", {
    owner_id: userId,
  });
  if (data) {
    let tokens;
    try {
      tokens = tokensSchema.parse(unseal(data));
    } catch {
      tokens = null;
    }
    if (tokens) {
      const response = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: tokens.refresh_token }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok && response.status !== 400)
        throw new ApiError(
          502,
          "Revoca Google non confermata. Riprova o revoca l’accesso dal tuo account Google.",
        );
    }
  }
  const { error } = await client.rpc("drive_connection_delete", {
    owner_id: userId,
  });
  checkDb(error, "Connessione non rimossa.");
}
