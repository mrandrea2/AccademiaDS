"use client";
import { useCurated } from "@/lib/use-curated";
import { flashcards as demoFlashcards, topics } from "@/lib/content";
import { scheduleReview } from "@/lib/learning";
import type { StudyState } from "@/lib/models";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

import {
  Badge,
  Empty,
  Panel,
  Provenance,
  addSession,
  useClock,
  type Update,
} from "@/components/shared";
export function Cards({
  state,
  update,
}: {
  state: StudyState;
  update: Update;
}) {
  const curated = useCurated();
  const flashcards = [...demoFlashcards, ...curated.flashcards];
  const now = useClock();
  const [revealed, setRevealed] = useState(false);
  const [all, setAll] = useState(false);
  const [area, setArea] = useState("");
  const [message, setMessage] = useState("");
  const due = flashcards.filter(
    (f) =>
      (!area || f.topicId === area) &&
      (all ||
        !state.reviews[f.id] ||
        Date.parse(state.reviews[f.id].due) <= now),
  );
  const card = due[0];
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, [card?.id]);
  return (
    <>
      <div className="toolbar">
        <label>
          Area
          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setRevealed(false);
            }}
          >
            <option value="">Tutte le aree</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => {
              setAll(e.target.checked);
              setRevealed(false);
            }}
          />
          Includi anche le carte non in scadenza
        </label>
      </div>
      <p role="status">{message}</p>
      {card ? (
        <Panel className="flashcard">
          <Badge>{due.length} carte disponibili · SM-2</Badge>
          <p className="eyebrow">
            {topics.find((t) => t.id === card.topicId)?.title}
          </p>
          <h2>{card.front}</h2>
          {revealed ? (
            <>
              <div className="flash-answer">{card.back}</div>
              <p>Quanto è stato facile ricordare?</p>
              <div className="inline-actions">
                {[
                  { q: 1, label: "Da ripetere" },
                  { q: 3, label: "Con fatica" },
                  { q: 4, label: "Ricordata" },
                  { q: 5, label: "Facile" },
                ].map((g) => (
                  <Button
                    key={g.q}
                    variant="outline"
                    onClick={() => {
                      const review = {
                        ...scheduleReview(state.reviews[card.id], g.q),
                        cardId: card.id,
                      };
                      update((s) =>
                        addSession(
                          {
                            ...s,
                            reviews: { ...s.reviews, [card.id]: review },
                          },
                          "review",
                          "Ripasso flashcard",
                          (Date.now() - started.current) / 60000,
                          card.topicId,
                        ),
                      );
                      setMessage(
                        `Prossimo ripasso: ${new Date(review.due).toLocaleDateString("it-IT")}.`,
                      );
                      setRevealed(false);
                      setAll(false);
                    }}
                  >
                    {g.label}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <Button onClick={() => setRevealed(true)}>Mostra risposta</Button>
          )}
          <Provenance source={card.source} />
        </Panel>
      ) : (
        <Panel>
          <Empty title="Ripasso completato">
            Nessuna carta in scadenza per questa selezione. Puoi includere le
            altre carte per un ripasso anticipato.
          </Empty>
        </Panel>
      )}
    </>
  );
}
