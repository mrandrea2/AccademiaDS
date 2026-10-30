"use client";
import { retrieve } from "@/lib/learning";
import type { StudyState } from "@/lib/models";
import { Search, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

import { Badge, Panel } from "@/components/shared";
interface TutorAnswer {
  answer: string;
  uncertainty: string;
  citations: number[];
  sources: {
    document_id?: string;
    documentId?: string;
    title: string;
    page: number | null;
    section?: string;
    quotes?: string[];
    version: string;
    content?: string;
    text?: string;
  }[];
  mode: string;
}
export function Tutor({
  state,
  cloud,
  go,
}: {
  state: StudyState;
  cloud: boolean;
  go: (id: string) => void;
}) {
  const [availableSources, setAvailableSources] = useState<
    { id: string; title: string }[]
  >([]);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [semantic, setSemantic] = useState(false);
  const [synthesize, setSynthesize] = useState(false);
  useEffect(() => {
    if (!cloud) return;
    fetch("/api/materials")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data)
          setAvailableSources(
            Array.from(
              new Map(
                (data.versions ?? [])
                  .filter((v: { status: string }) => v.status === "indexed")
                  .map(
                    (v: {
                      material_id: string;
                      materials: { title: string };
                    }) => [
                      v.material_id,
                      { id: v.material_id, title: v.materials.title },
                    ],
                  ),
              ).values(),
            ) as { id: string; title: string }[],
          );
      })
      .catch(() => {});
  }, [cloud]);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<TutorAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Panel className="tutor-intro">
        <div className="icon-tile blue">
          <Sparkles size={25} />
        </div>
        <h2>Studia con le fonti al tuo fianco.</h2>
        <p>
          {cloud
            ? "Ricerca privata sui documenti salvati. Sintesi AI disponibile solo con configurazione server."
            : "Ricerca testuale locale, senza AI e senza invio dei tuoi documenti a servizi esterni."}
        </p>
        <p className="source-note">
          Le citazioni rendono rintracciabile un passaggio, ma non ne
          certificano correttezza o vigenza.
        </p>
      </Panel>
      <Panel>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setAnswer(null);
            try {
              if (cloud) {
                const response = await fetch("/api/tutor", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    query,
                    sourceIds,
                    semantic,
                    synthesize,
                  }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setAnswer(data);
              } else {
                const sources = retrieve(
                  query,
                  sourceIds.length
                    ? state.documents.filter((d) => sourceIds.includes(d.id))
                    : state.documents,
                );
                setAnswer({
                  answer: sources.length
                    ? "Ho trovato questi passaggi pertinenti nei tuoi documenti. Leggili nel loro contesto prima di formulare una conclusione."
                    : "Non ho trovato evidenze sufficienti. Aggiungi un documento pertinente o riformula la domanda.",
                  uncertainty:
                    "Ricerca lessicale, senza sintesi AI. Non posso attestare completezza, correttezza normativa o aggiornamento.",
                  citations: sources.map((_, i) => i + 1),
                  sources,
                  mode: "retrieval",
                });
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : "Ricerca non riuscita");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Che cosa vuoi approfondire?
            <textarea
              rows={3}
              required
              minLength={3}
              maxLength={1000}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca un concetto nei documenti che hai aggiunto…"
            />
          </label>
          <label>
            Fonti (nessuna selezione: tutte le fonti disponibili)
            <select
              className="source-filter"
              multiple
              value={sourceIds}
              onChange={(e) =>
                setSourceIds(
                  Array.from(e.target.selectedOptions).map((o) => o.value),
                )
              }
            >
              {[
                ...availableSources,
                ...state.documents.map((d) => ({ id: d.id, title: d.title })),
              ].map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>
          {cloud && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={semantic}
                onChange={(e) => setSemantic(e.target.checked)}
              />
              Ricerca semantica opzionale: invia la domanda al provider
              embeddings se configurato.
            </label>
          )}
          {cloud && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={synthesize}
                onChange={(e) => setSynthesize(e.target.checked)}
              />
              Richiedi sintesi AI (solo fonti con consenso esterno; massimo
              quattro estratti).
            </label>
          )}
          <div className="inline-actions">
            <Button disabled={busy} type="submit">
              <Search size={18} />
              {busy ? "Ricerca in corso…" : "Cerca nei miei documenti"}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => go("biblioteca")}
            >
              Gestisci le fonti
            </Button>
          </div>
        </form>
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        {busy && <div className="skeleton h-32" />}
        {answer && (
          <div role="status" className="tutor-answer">
            <Badge>
              {answer.mode === "ai"
                ? "Sintesi generata da AI · da verificare"
                : "Estratti documentali · nessuna sintesi AI"}
            </Badge>
            <p className="preserve">{answer.answer}</p>
            <p className="notice">{answer.uncertainty}</p>
            {answer.sources.map((s, i) => (
              <article key={i} className="citation">
                <h3>
                  [{i + 1}] {s.title}
                </h3>
                <p>
                  {s.page
                    ? `Pagina ${s.page}`
                    : `Sezione ${s.section || "non specificata"}`}{" "}
                  · versione {s.version} ·{" "}
                  {answer.citations.includes(i + 1)
                    ? "citato nella risposta"
                    : "contesto recuperato"}{" "}
                  · fonte non verificata
                </p>
                <blockquote className="preserve">
                  {s.quotes?.length
                    ? s.quotes.join("\n\n")
                    : (s.content ?? s.text)}
                </blockquote>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
