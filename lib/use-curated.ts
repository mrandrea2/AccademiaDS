"use client";
import { useEffect, useState } from "react";
import type { Question, Flashcard, Case, SourceRef } from "./models";
import { draftBodySchema } from "./ingestion/contracts";
export interface CuratedSummary {
  id: string;
  title: string;
  body: string;
  topicId: string;
  source: SourceRef;
}
export function useCurated() {
  const [curated, setCurated] = useState<{
    questions: Question[];
    flashcards: Flashcard[];
    cases: Case[];
    summaries: CuratedSummary[];
  }>({ questions: [], flashcards: [], cases: [], summaries: [] });
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/materials/published", { signal: abort.signal })
      .then((r) => r.json())
      .then((data) => {
        const next: typeof curated = {
          questions: [],
          flashcards: [],
          cases: [],
          summaries: [],
        };
        for (const row of data.drafts ?? []) {
          const parsed = draftBodySchema.safeParse(row.body);
          if (!parsed.success) continue;
          const body = parsed.data;
          const id = `curated-${row.id}`;
          const topicId = row.materials?.area || "organizzazione";
          const source: SourceRef = {
            title: row.materials?.title,
            page: row.citations?.[0]?.page ?? undefined,
            section:
              row.citations?.[0]?.section ??
              `Segmento ${(row.citations?.[0]?.segmentOrdinal ?? 0) + 1}`,
            quote: row.citations?.[0]?.quote,
            documentId: row.material_id,
            version: String(row.material_versions?.version),
            provenance: row.provenance === "ai" ? "ai" : "personal",
            verification: row.materials?.verification ?? "unverified",
          };
          if (body.kind === "quiz")
            next.questions.push({
              id,
              topicId,
              ...body,
              difficulty: "intermedia",
              source,
            });
          else if (body.kind === "flashcard")
            next.flashcards.push({
              id,
              topicId,
              front: body.front,
              back: body.back,
              source,
            });
          else if (body.kind === "case")
            next.cases.push({
              id,
              title: body.title,
              scenario: body.scenario,
              steps: body.steps,
              source,
            });
          else
            next.summaries.push({
              id,
              title: body.title,
              body: body.body,
              topicId,
              source,
            });
        }
        setCurated(next);
      })
      .catch(() => {});
    return () => abort.abort();
  }, []);
  return curated;
}
