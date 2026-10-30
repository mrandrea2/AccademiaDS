"use client";
import { useCurated } from "@/lib/use-curated";
import { cases as demoCases } from "@/lib/content";
import type { StudyState } from "@/lib/models";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import {
  Panel,
  Provenance,
  addSession,
  type Update,
} from "@/components/shared";
const fourMoves = [
  "1. Inquadra il problema",
  "2. Collega fatti e fonti",
  "3. Motiva la decisione",
  "4. Definisci azioni e verifica",
];
export function Written({
  state,
  update,
  status,
}: {
  state: StudyState;
  update: Update;
  status: string;
}) {
  const curated = useCurated();
  const cases = [...demoCases, ...curated.cases];
  const [minutes, setMinutes] = useState(30);
  const [remaining, setRemaining] = useState(1800);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const checks = state.writtenChecks;
  const started = useRef(0);
  const deadline = useRef(0);
  const current = cases.find((c) => c.id === state.written.caseId) ?? cases[0];
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () =>
        setRemaining(() =>
          Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)),
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (remaining === 0 && running) {
      const t = setTimeout(() => setRunning(false), 0);
      return () => clearTimeout(t);
    }
  }, [remaining, running]);
  const words = state.written.text.trim()
    ? state.written.text.trim().split(/\s+/).length
    : 0;
  return (
    <div className="editor-grid">
      <Panel>
        <label>
          Traccia
          <select
            value={current.id}
            onChange={(e) => {
              if (
                !state.written.text ||
                confirm("Cambiare traccia mantenendo il testo della bozza?")
              )
                update((s) => ({
                  ...s,
                  written: { ...s.written, caseId: e.target.value },
                }));
            }}
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <p className="scenario">{current.scenario}</p>
        <Provenance source={current.source} />
        <label>
          La tua risposta
          <textarea
            className="writing-editor"
            rows={17}
            maxLength={100000}
            value={state.written.text}
            placeholder="Inquadra il problema, richiama le fonti da verificare e costruisci una proposta motivata…"
            onChange={(e) =>
              update((s) => ({
                ...s,
                written: {
                  ...s.written,
                  text: e.target.value,
                  updatedAt: new Date().toISOString(),
                },
              }))
            }
          />
        </label>
        <div className="section-header">
          <small role="status">
            {status} · {words} parole
          </small>
          <Button
            disabled={!words}
            onClick={() => {
              setFeedback(true);
              update((s) =>
                addSession(
                  s,
                  "written",
                  "Revisione prova scritta",
                  started.current ? (Date.now() - started.current) / 60000 : 0,
                ),
              );
            }}
          >
            Analizza la struttura
          </Button>
        </div>
        {feedback && (
          <div className="feedback">
            <h3>Feedback strutturale, non valutazione d’esame</h3>
            <p>
              {words < 150
                ? "Risposta breve: considera se hai sviluppato motivazioni, alternative e verifica degli esiti."
                : "La risposta ha uno sviluppo articolato: controlla pertinenza e sintesi, senza confondere lunghezza e qualità."}
            </p>
            {fourMoves.map((m, i) => (
              <p key={m}>
                <strong>{m}</strong>:{" "}
                {checks[i]
                  ? "Passaggio dichiarato presente: verifica che sia sostenuto da evidenze."
                  : "Passaggio non ancora confermato: esplicitalo nella risposta."}
              </p>
            ))}
            <p>
              Nessun controllo automatico della correttezza normativa. Confronta
              ogni citazione con la fonte originale.
            </p>
          </div>
        )}
      </Panel>
      <div className="stack">
        <Panel>
          <h2>Il tuo tempo</h2>
          <label>
            Durata (minuti)
            <input
              type="number"
              min={1}
              max={240}
              disabled={running}
              value={minutes}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                if (n >= 1 && n <= 240) {
                  setMinutes(n);
                  setRemaining(n * 60);
                }
              }}
            />
          </label>
          <p className="timer" role="timer">
            {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </p>
          <div className="inline-actions">
            <Button
              disabled={remaining === 0}
              onClick={() => {
                if (!started.current) started.current = Date.now();
                if (!running) deadline.current = Date.now() + remaining * 1000;
                setRunning(!running);
              }}
            >
              {running ? "Pausa" : "Avvia timer"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setRunning(false);
                setRemaining(minutes * 60);
                started.current = 0;
              }}
            >
              Reimposta
            </Button>
          </div>
          {remaining === 0 && (
            <p role="alert">
              Tempo terminato. Puoi continuare a rivedere il testo.
            </p>
          )}
        </Panel>
        <Panel>
          <h2>La griglia delle quattro mosse</h2>
          <p>Schema personale di autovalutazione, non griglia ufficiale.</p>
          {fourMoves.map((m, i) => (
            <label className="check-label" key={m}>
              <input
                type="checkbox"
                checked={checks[i]}
                onChange={(e) =>
                  update((s) => ({
                    ...s,
                    writtenChecks: s.writtenChecks.map((v, n) =>
                      n === i ? e.target.checked : v,
                    ),
                  }))
                }
              />
              {m}
            </label>
          ))}
        </Panel>
      </div>
    </div>
  );
}
