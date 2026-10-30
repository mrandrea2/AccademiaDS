import { NextResponse } from "next/server";
import { adminHandler, checkDb, ApiError } from "@/lib/ingestion/auth";
import { driveConfigured, driveConnected } from "@/lib/ingestion/drive";
export const GET = adminHandler(async (request, { db, user }) => {
  const params = new URL(request.url).searchParams;
  const offset = Math.max(
    0,
    Math.min(10000, Number(params.get("offset")) || 0),
  );
  const {
    data: versions,
    error,
    count,
  } = await db
    .from("material_versions")
    .select("*,materials(*)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + 99);
  checkDb(error, "Impossibile caricare gli import.");
  const { data: events } = await db
    .from("ingestion_events")
    .select("id,version_id,message,level,created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  const { data: syncs } = await db
    .from("drive_sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(5);
  const { data: drafts } = await db
    .from("teaching_drafts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  const { data: driveItems } = await db
    .from("drive_items")
    .select("file_id,name,status,last_error")
    .order("name")
    .limit(200);
  return NextResponse.json({
    versions,
    events,
    syncs,
    drafts,
    driveItems,
    total: count,
    offset,
    capabilities: {
      driveConfigured: driveConfigured(),
      driveConnected: await driveConnected(user.id),
      embeddings: Boolean(process.env.AI_API_KEY),
      ocr: Boolean(process.env.OCR_SERVICE_URL && process.env.OCR_SERVICE_KEY),
    },
  });
});
export const DELETE = adminHandler(async (request, { db }) => {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new ApiError(400, "Identificativo richiesto.");
  const { data, error } = await db
    .from("material_versions")
    .select("storage_path,material_id")
    .eq("id", id)
    .single();
  checkDb(error, "Versione non trovata.");
  const { error: storageError } = await db.storage
    .from("academy-materials")
    .remove([data!.storage_path]);
  checkDb(
    storageError,
    "Eliminazione originale non riuscita: nessun dato DB cancellato.",
  );
  const { error: deleteError } = await db
    .from("material_versions")
    .delete()
    .eq("id", id);
  checkDb(deleteError, "Eliminazione indice non riuscita.");
  const { count } = await db
    .from("material_versions")
    .select("id", { head: true, count: "exact" })
    .eq("material_id", data!.material_id);
  if (count === 0)
    await db.from("materials").delete().eq("id", data!.material_id);
  return NextResponse.json({ deleted: true });
});
