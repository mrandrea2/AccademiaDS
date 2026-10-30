import { NextResponse } from "next/server";
import { z } from "zod";
import { adminHandler, ApiError, jsonBody } from "@/lib/ingestion/auth";
import { discoverDrive, nextDriveFile } from "@/lib/ingestion/drive";
export const maxDuration = 60;
export const POST = adminHandler(async (request, context) => {
  const input = z
    .object({
      action: z.enum(["discover", "next", "cancel"]),
      runId: z.uuid().optional(),
      licenseConfirmed: z.literal(true),
      externalConsent: z.boolean().default(false),
    })
    .safeParse(await jsonBody(request));
  if (!input.success)
    throw new ApiError(
      400,
      "Conferma i diritti d’uso prima della sincronizzazione.",
    );
  if (input.data.action === "discover")
    return NextResponse.json(await discoverDrive(context));
  if (!input.data.runId) throw new ApiError(400, "Sincronizzazione richiesta.");
  if (input.data.action === "cancel") {
    await context.db
      .from("drive_sync_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        errors: ["Annullata manualmente; originali già acquisiti conservati."],
      })
      .eq("id", input.data.runId)
      .eq("status", "running");
    return NextResponse.json({ cancelled: true });
  }
  return NextResponse.json(
    await nextDriveFile(context, input.data.runId, input.data.externalConsent),
  );
});
