import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminHandler,
  ApiError,
  jsonBody,
  checkDb,
} from "@/lib/ingestion/auth";
import { draftSchema, draftBodySchema } from "@/lib/ingestion/contracts";
import { versionFor } from "@/lib/ingestion/service";
import { exactQuote } from "@/lib/ingestion/extract";
export const maxDuration = 60;
export const POST = adminHandler(async (request, { db, user }) => {
  const input = draftSchema.safeParse(await jsonBody(request));
  if (!input.success)
    throw new ApiError(
      400,
      "Bozza non valida: verifica struttura e citazioni.",
    );
  const v = await versionFor(db, input.data.versionId);
  if (v.status !== "indexed")
    throw new ApiError(409, "Approva e indicizza prima la fonte.");
  const citations: {
    segmentOrdinal: number;
    quote: string;
    page: number | null;
    section: string;
  }[] = [];
  for (const citation of input.data.citations) {
    const { data } = await db
      .from("material_segments")
      .select("text,page,section")
      .eq("version_id", v.id)
      .eq("ordinal", citation.segmentOrdinal)
      .single();
    if (!data || !exactQuote(citation.quote, data.text))
      throw new ApiError(
        400,
        "La citazione non corrisponde al testo originale.",
      );
    citations.push({ ...citation, page: data.page, section: data.section });
  }
  const { data, error } = await db
    .from("teaching_drafts")
    .insert({
      user_id: user.id,
      material_id: v.material_id,
      version_id: v.id,
      body: input.data.body,
      citations,
      provenance: "personal",
      status: "draft",
    })
    .select()
    .single();
  checkDb(error, "Bozza non salvata.");
  return NextResponse.json({ draft: data });
});
export const PUT = adminHandler(async (request, { db, user }) => {
  const input = z
    .object({
      id: z.uuid(),
      action: z.enum(["edit", "approve", "reject"]),
      body: draftBodySchema.optional(),
      reviewNote: z.string().trim().min(10).max(2000).optional(),
    })
    .safeParse(await jsonBody(request));
  if (!input.success) throw new ApiError(400, "Revisione bozza non valida.");
  const { data: draft, error } = await db
    .from("teaching_drafts")
    .select("*")
    .eq("id", input.data.id)
    .single();
  checkDb(error, "Bozza non trovata.");
  if (!draft) throw new ApiError(404, "Bozza non trovata.");
  if (input.data.action === "edit") {
    if (!input.data.body) throw new ApiError(400, "Contenuto richiesto.");
    const { error } = await db
      .from("teaching_drafts")
      .update({
        body: input.data.body,
        status: "draft",
        approved_at: null,
        approved_by: null,
        review_note: null,
      })
      .eq("id", draft.id);
    checkDb(error, "Modifica non salvata.");
  } else {
    if (!input.data.reviewNote)
      throw new ApiError(
        400,
        "Aggiungi una nota di revisione (almeno 10 caratteri).",
      );
    const parsed = draftSchema.safeParse({
      versionId: draft.version_id,
      body: draft.body,
      citations: draft.citations,
    });
    if (!parsed.success)
      throw new ApiError(400, "Contenuto o citazioni non validi.");
    for (const c of parsed.data.citations) {
      const { data } = await db
        .from("material_segments")
        .select("text")
        .eq("version_id", draft.version_id)
        .eq("ordinal", c.segmentOrdinal)
        .single();
      if (!data || !exactQuote(c.quote, data.text))
        throw new ApiError(409, "Fonte modificata: rivedi prima le citazioni.");
    }
    const { error } = await db
      .from("teaching_drafts")
      .update({
        status: input.data.action === "approve" ? "approved" : "rejected",
        approved_at:
          input.data.action === "approve" ? new Date().toISOString() : null,
        approved_by: input.data.action === "approve" ? user.id : null,
        review_note: input.data.reviewNote,
      })
      .eq("id", draft.id);
    checkDb(error, "Revisione non salvata.");
  }
  return NextResponse.json({ saved: true });
});
