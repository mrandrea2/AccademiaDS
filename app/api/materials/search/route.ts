import { NextResponse } from "next/server";
import { adminHandler, ApiError, jsonBody } from "@/lib/ingestion/auth";
import { searchSchema } from "@/lib/ingestion/contracts";
import { searchMaterials } from "@/lib/ingestion/search";
export const POST = adminHandler(async (request, { db }) => {
  const input = searchSchema.safeParse(await jsonBody(request));
  if (!input.success) throw new ApiError(400, "Ricerca non valida.");
  return NextResponse.json(
    await searchMaterials(
      db,
      input.data.query,
      input.data.sourceIds,
      input.data.semantic,
    ),
  );
});
