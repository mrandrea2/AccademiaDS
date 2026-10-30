"use client";
import { topics } from "@/lib/content";
import { accuracy, weakTopics } from "@/lib/learning";
import type { StudyState } from "@/lib/models";

import { Empty, Panel, Progress, useClock } from "@/components/shared";
export function Statistics({ state }: { state: StudyState }) {
  const now = useClock();
  const weak = weakTopics(state.attempts);
  const avg = state.attempts.length
    ? Math.round(
        state.attempts.reduce((n, a) => n + a.seconds, 0) /
          state.attempts.length,
      )
    : 0;
  const due = Object.values(state.reviews).filter(
    (r) => Date.parse(r.due) < now,
  );
  return (
    <>
      <div className="kpi-grid">
        {[
          { title: "Risposte registrate", value: state.attempts.length },
          {
            title: "Accuratezza complessiva",
            value: `${accuracy(state.attempts)}%`,
          },
          { title: "Tempo medio per risposta", value: `${avg} s` },
          { title: "Ripassi scaduti", value: due.length },
        ].map((k) => (
          <Panel key={k.title}>
            <p>{k.title}</p>
            <strong className="stat-value">{k.value}</strong>
          </Panel>
        ))}
      </div>
      {!state.attempts.length ? (
        <Panel>
          <Empty title="I tuoi dati raccontano il tuo percorso">
            Completa una sessione quiz per vedere accuratezza, tempi e aree da
            ripassare. Nessuna stima fittizia viene mostrata.
          </Empty>
        </Panel>
      ) : (
        <div className="dashboard-middle">
          <Panel>
            <h2>Accuratezza per area</h2>
            {weak.map((w) => (
              <div className="stat-row" key={w.id}>
                <div className="section-header">
                  <strong>{topics.find((t) => t.id === w.id)?.title}</strong>
                  <span>
                    {w.accuracy}% · {w.count} risposte
                  </span>
                </div>
                <Progress value={w.accuracy} label={`Accuratezza ${w.id}`} />
              </div>
            ))}
            <p className="source-note">
              Risultati sui soli quesiti dimostrativi; campione limitato, non
              una previsione d’esame.
            </p>
          </Panel>
          <Panel>
            <h2>Ripasso consigliato</h2>
            <p>
              Parti da {topics.find((t) => t.id === weak[0].id)?.title}: è
              l’area con l’accuratezza più bassa tra quelle esercitate.
            </p>
            <h3>Argomenti da riattivare</h3>
            <p>
              {due.length
                ? `${due.length} flashcard oltre la data di ripasso. La scadenza indica un ripasso previsto, non prova che l’argomento sia dimenticato.`
                : "Nessuna flashcard scaduta tra quelle già ripassate."}
            </p>
          </Panel>
        </div>
      )}
      <Panel>
        <h2>Trend degli ultimi sette giorni</h2>
        <div className="trend-chart">
          {Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setUTCDate(date.getUTCDate() - 6 + i);
            const day = date.toISOString().slice(0, 10);
            const attempts = state.attempts.filter(
              (a) => a.at.slice(0, 10) === day,
            );
            return (
              <div className="trend-day" key={day}>
                <span>{attempts.length ? `${accuracy(attempts)}%` : "—"}</span>
                <div className="trend-track">
                  <div
                    style={{
                      height: `${attempts.length ? accuracy(attempts) : 0}%`,
                    }}
                  />
                </div>
                <small>
                  {date.toLocaleDateString("it-IT", {
                    weekday: "short",
                    timeZone: "UTC",
                  })}
                </small>
                <small>{attempts.length} risp.</small>
              </div>
            );
          })}
        </div>
        <p className="source-note">
          Giorni aggregati in UTC; assenza di risposte indicata con un trattino.
        </p>
      </Panel>
    </>
  );
}
