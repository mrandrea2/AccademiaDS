"use client";
import { retrieve } from "@/lib/learning";
import type { StudyState } from "@/lib/models";
import { Search, Sparkles } from "lucide-react";
import { useState } from "react";
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
    page: number;
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
                  body: JSON.stringify({ query }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setAnswer(data);
              } else {
                const sources = retrieve(query, state.documents);
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
                  Pagina {s.page} · versione {s.version} ·{" "}
                  {answer.citations.includes(i + 1)
                    ? "citato nella risposta"
                    : "contesto recuperato"}{" "}
                  · fonte non verificata
                </p>
                <blockquote className="preserve">
                  {s.content ?? s.text}
                </blockquote>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
