import { z } from "zod";
import { event } from "@/lib/ingestion/service";
import { NextResponse } from "next/server";
import {
  adminHandler,
  ApiError,
  checkDb,
  jsonBody,
} from "@/lib/ingestion/auth";
import { uploadSchema, BUCKET } from "@/lib/ingestion/contracts";
export const POST = adminHandler(async (request, { db }) => {
  const parsed = uploadSchema.safeParse(await jsonBody(request));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const input = parsed.data;
  const { data, error } = await db.rpc("reserve_material", {
    file_title: input.title,
    file_name: input.fileName,
    mime: input.mimeType,
    bytes: input.size,
    external_allowed: input.externalConsent,
    parent_id: input.materialId ?? null,
    remote_id: null,
  });
  checkDb(error, "Impossibile riservare il caricamento.");
  return NextResponse.json({ version: data, bucket: BUCKET });
});
export const PUT = adminHandler(async (request, { db, user }) => {
  const input = z
    .object({ versionId: z.uuid() })
    .safeParse(await jsonBody(request));
  if (!input.success) throw new ApiError(400, "Versione non valida.");
  const { error } = await db
    .from("material_versions")
    .update({
      status: "error",
      error_message:
        "Upload dal browser interrotto o rifiutato. Elimina la prenotazione e ricarica il file.",
    })
    .eq("id", input.data.versionId)
    .eq("status", "uploaded");
  checkDb(error, "Stato upload non salvato.");
  await event(
    db,
    input.data.versionId,
    user.id,
    "Upload dal browser interrotto o rifiutato.",
    "error",
  );
  return NextResponse.json({ recorded: true });
});
