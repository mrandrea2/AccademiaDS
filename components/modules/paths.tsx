"use client";
import { lessons, topics } from "@/lib/content";
import type { StudyState } from "@/lib/models";
import { ArrowRight, Check } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import {
  Badge,
  Panel,
  Provenance,
  addSession,
  type Update,
} from "@/components/shared";
export function Paths({
  state,
  update,
}: {
  state: StudyState;
  update: Update;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const started = useRef(0);
  const lesson = lessons.find((l) => l.topicId === selected);
  return (
    <>
      <p className="notice">
        Struttura didattica dimostrativa: le nove aree e le schede richiedono
        confronto con il programma ufficiale. Nessuna normativa viene
        considerata verificata.
      </p>
      {lesson ? (
        <Panel>
          <button className="text-link" onClick={() => setSelected(null)}>
            ← Torna alle aree
          </button>
          <h2>{lesson.title}</h2>
          <Provenance />
          <p className="reading">{lesson.body}</p>
          <h3>Esempio di applicazione</h3>
          <p>{lesson.example}</p>
          <h3>Glossario</h3>
          <dl>
            {Object.entries(lesson.glossary).map(([word, text]) => (
              <div key={word}>
                <dt>{word}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
          <h3>Approfondimento guidato</h3>
          <p>
            Quali informazioni mancano? Quale documento primario consulteresti?
            Annota autore, pagina, versione e data prima di utilizzare una
            conclusione nello studio.
          </p>
          <Button
            disabled={state.completedLessons.includes(lesson.id)}
            onClick={() =>
              update((s) =>
                addSession(
                  {
                    ...s,
                    completedLessons: [
                      ...new Set([...s.completedLessons, lesson.id]),
                    ],
                  },
                  "lesson",
                  lesson.title,
                  (Date.now() - started.current) / 60000,
                  lesson.topicId,
                ),
              )
            }
          >
            <Check size={18} />
            {state.completedLessons.includes(lesson.id)
              ? "Lezione completata"
              : "Segna come studiata"}
          </Button>
        </Panel>
      ) : (
        <div className="catalog-grid">
          {topics.map((t, i) => (
            <Panel key={t.id}>
              <div className="section-header">
                <span className={`area-number area-${i % 4}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Badge>
                  {state.completedLessons.includes(`lezione-${t.id}`)
                    ? "Completata"
                    : "Da esplorare"}
                </Badge>
              </div>
              <h2>{t.title}</h2>
              <p>{t.description}</p>
              <p className="muted">
                1 scheda · glossario · esempio · non verificata
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  started.current = Date.now();
                  setSelected(t.id);
                }}
              >
                Esplora l’area <ArrowRight size={17} />
              </Button>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
