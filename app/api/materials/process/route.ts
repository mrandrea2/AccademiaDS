import { NextResponse } from "next/server";
import { z } from "zod";
import { adminHandler, ApiError, jsonBody } from "@/lib/ingestion/auth";
import { processVersion, embedVersion, event } from "@/lib/ingestion/service";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = adminHandler(async (request, context) => {
  const input = z
    .object({
      versionId: z.uuid(),
      mode: z.enum(["extract", "embed"]).default("extract"),
    })
    .safeParse(await jsonBody(request));
  if (!input.success) throw new ApiError(400, "Lavoro non valido.");
  try {
    return NextResponse.json(
      input.data.mode === "embed"
        ? await embedVersion(context, input.data.versionId)
        : await processVersion(context, input.data.versionId),
    );
  } catch (error) {
    if (input.data.mode === "embed")
      await event(
        context.db,
        input.data.versionId,
        context.user.id,
        "Indicizzazione semantica interrotta; full-text conservato, lotto riprendibile.",
        "error",
      );
    throw error;
  }
});
