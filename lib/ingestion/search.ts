import "server-only";
import type { AdminContext } from "./auth";
import { ApiError, checkDb } from "./auth";
import { embedTexts } from "./service";
import type { RetrievedSource } from "./contracts";
export async function searchMaterials(
  db: AdminContext["db"],
  query: string,
  sourceIds: string[],
  semantic: boolean,
) {
  let embedding: number[] | null = null;
  let warning = "";
  if (semantic && process.env.AI_API_KEY) {
    try {
      embedding = (await embedTexts([query]))[0];
    } catch {
      warning = "Ricerca semantica non disponibile: applicato solo full-text.";
    }
  } else if (semantic)
    warning = "Embeddings non configurati: ricerca full-text.";
  const { data, error } = await db.rpc("search_materials", {
    search_query: query,
    source_ids: sourceIds,
    query_embedding: embedding ? JSON.stringify(embedding) : null,
  });
  checkDb(error, "Indice materiali non disponibile: applica la migration 002.");
  return { sources: (data ?? []) as RetrievedSource[], warning };
}
export function validateCitations(
  citations: { source: number; quote: string }[],
  sources: RetrievedSource[],
) {
  if (!citations.length || citations.length > 4)
    throw new ApiError(502, "Nessuna citazione verificabile.");
  for (const c of citations) {
    const source = sources[c.source - 1];
    if (
      !source ||
      c.quote.length < 10 ||
      c.quote.length > 600 ||
      !source.content.includes(c.quote)
    )
      throw new ApiError(
        502,
        "La citazione non corrisponde all’estratto: risposta rifiutata.",
      );
  }
  return citations;
}
