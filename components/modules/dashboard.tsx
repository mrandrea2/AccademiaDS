"use client";
import { flashcards, lessons, topics } from "@/lib/content";
import { accuracy, weakTopics } from "@/lib/learning";
import type { StudyState } from "@/lib/models";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Flame,
  GraduationCap,
  Layers,
  ListChecks,
  Mic,
  PenLine,
  Route,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { Badge, Panel, Progress, useClock } from "@/components/shared";
export function Dashboard({
  state,
  go,
}: {
  state: StudyState;
  go: (id: string) => void;
}) {
  const now = useClock();
  const weekAgo = now - 7 * 86400000;
  const minutes = Math.round(
    state.sessions
      .filter((s) => Date.parse(s.at) >= weekAgo)
      .reduce((n, s) => n + s.minutes, 0),
  );
  const completed = Math.round(
    (state.completedLessons.length / lessons.length) * 100,
  );
  const due = flashcards.filter(
    (f) => !state.reviews[f.id] || Date.parse(state.reviews[f.id].due) <= now,
  ).length;
  const weak = weakTopics(state.attempts);
  const next =
    topics.find((t) => !state.completedLessons.includes(`lezione-${t.id}`)) ??
    topics[0];
  return (
    <>
      <div className="dashboard-top">
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-tag">
              <span /> PREPARAZIONE CONSAPEVOLE
            </span>
            <h2>
              La scuola di domani
              <br />
              ha bisogno della tua visione.
            </h2>
            <p>
              Trasforma lo studio in competenze.
              <br />
              Il tuo percorso verso la dirigenza comincia oggi.
            </p>
            <Button onClick={() => go("percorsi")}>
              Riprendi il tuo percorso <ArrowRight size={18} />
            </Button>
            <span className="hero-foot">
              <BookOpen size={15} /> 9 aree di studio · Un unico obiettivo
            </span>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit one" />
            <div className="orbit two" />
            <div className="art-grid" />
            <div className="floating-card back">
              <span />
              <span />
              <span />
            </div>
            <div className="floating-card front">
              <div className="art-icon">
                <GraduationCap size={42} />
              </div>
              <div className="art-title" />
              <div className="art-line" />
              <div className="art-line short" />
              <div className="art-progress">
                <span />
              </div>
              <div className="art-stars">✦ ✦ ✦</div>
            </div>
            <span className="art-spark spark-one">✦</span>
            <span className="art-spark spark-two">✦</span>
            <div className="art-seal">
              <Check size={25} />
            </div>
          </div>
        </section>
        <Panel className="weekly">
          <div className="section-title">
            <span className="icon-tile gold">
              <Target size={21} />
            </span>
            <h2>Il tuo obiettivo settimanale</h2>
          </div>
          <p>Ogni sessione conta. Mantieni il ritmo.</p>
          <div
            className="goal-circle"
            style={
              {
                "--progress": `${Math.min(100, (minutes / state.goal.weeklyMinutes) * 100)}%`,
              } as React.CSSProperties
            }
          >
            <div>
              <strong>
                {minutes}
                <small> / {state.goal.weeklyMinutes}</small>
              </strong>
              <span>minuti di studio</span>
            </div>
          </div>
          <div className="weekly-caption">
            <span className="gold-dot" />
            {minutes >= state.goal.weeklyMinutes
              ? "Obiettivo raggiunto!"
              : "Costruisci la tua costanza"}
          </div>
          <button className="text-link" onClick={() => go("impostazioni")}>
            Personalizza obiettivo <ArrowRight size={15} />
          </button>
        </Panel>
      </div>
      <div className="kpi-grid">
        {[
          {
            label: "Percorso completato",
            value: `${completed}%`,
            sub: `${state.completedLessons.length} di ${lessons.length} lezioni`,
            icon: Route,
            color: "blue",
          },
          {
            label: "Accuratezza nei quiz",
            value: state.attempts.length ? `${accuracy(state.attempts)}%` : "—",
            sub: `${state.attempts.length} risposte registrate`,
            icon: Target,
            color: "green",
          },
          {
            label: "Da ripassare",
            value: String(due),
            sub: "Flashcard pronte per te",
            icon: Layers,
            color: "amber",
          },
          {
            label: "Tempo di studio",
            value: `${minutes} min`,
            sub: "Negli ultimi 7 giorni",
            icon: Clock3,
            color: "purple",
          },
        ].map((k) => (
          <Panel key={k.label} className="kpi">
            <span className={`icon-tile ${k.color}`}>
              <k.icon size={22} />
            </span>
            <div>
              <p>{k.label}</p>
              <strong>{k.value}</strong>
              <small>{k.sub}</small>
            </div>
          </Panel>
        ))}
      </div>
      <div className="dashboard-middle">
        <Panel>
          <div className="section-header">
            <div>
              <p className="eyebrow">CONTINUA A CRESCERE</p>
              <h2>Il tuo prossimo passo</h2>
            </div>
            <button className="text-link" onClick={() => go("percorsi")}>
              Tutti i percorsi <ArrowRight size={16} />
            </button>
          </div>
          <div className="next-lesson">
            <div className="lesson-art" aria-hidden="true">
              <BookOpen size={40} />
              <span>01</span>
            </div>
            <div>
              <Badge>
                Area {topics.indexOf(next) + 1} · Scheda dimostrativa
              </Badge>
              <h3>{next.title}</h3>
              <p>{next.description}</p>
              <div className="lesson-meta">
                <Clock3 size={15} /> Lettura guidata <span>·</span> Metodo ed
                esempi
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Apri il prossimo percorso"
              onClick={() => go("percorsi")}
            >
              <ArrowRight size={21} />
            </Button>
          </div>
          <div className="next-progress">
            <span>Avanzamento del percorso</span>
            <strong>{completed}%</strong>
          </div>
          <Progress value={completed} label="Percorso completato" />
        </Panel>
        <Panel className="tutor-card">
          <div className="tutor-orb">
            <Sparkles size={25} />
          </div>
          <Badge>IL TUO ALLEATO NELLO STUDIO</Badge>
          <h2>
            Una domanda.
            <br />
            Parti dalle fonti.
          </h2>
          <p>
            Esplora i tuoi documenti con il tutor e ritrova i passaggi che
            contano.
          </p>
          <button className="text-link" onClick={() => go("tutor")}>
            Apri il tutor <ArrowUpRight size={17} />
          </button>
        </Panel>
      </div>
      <div className="dashboard-bottom">
        <Panel>
          <div className="section-header">
            <h2>La tua cassetta degli attrezzi</h2>
            <span className="muted">Dalla teoria alla pratica</span>
          </div>
          <div className="tool-grid">
            {[
              {
                id: "quiz",
                icon: ListChecks,
                title: "Mettiti alla prova",
                text: "Quiz, errori e simulazioni",
                color: "blue",
              },
              {
                id: "scritta",
                icon: PenLine,
                title: "Allena la scrittura",
                text: "Dalle idee a una risposta",
                color: "purple",
              },
              {
                id: "orale",
                icon: Mic,
                title: "Dai voce alle idee",
                text: "Casi e autovalutazione",
                color: "green",
              },
            ].map((t) => (
              <button key={t.id} className="tool" onClick={() => go(t.id)}>
                <span className={`icon-tile ${t.color}`}>
                  <t.icon size={22} />
                </span>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
        </Panel>
        <Panel>
          <div className="section-header">
            <h2>Attività recente</h2>
            <Flame size={19} className="muted" />
          </div>
          {!state.sessions.length ? (
            <div className="activity-empty">
              <span className="icon-tile blue">
                <CalendarDays size={23} />
              </span>
              <p>Il tuo percorso è tutto da scrivere.</p>
              <small>Completa una lezione o un esercizio per iniziare.</small>
            </div>
          ) : (
            <ul className="activity-list">
              {state.sessions.slice(0, 4).map((s) => (
                <li key={s.id}>
                  <span className="activity-dot" />
                  <div>
                    <strong>{s.label}</strong>
                    <small>
                      {new Date(s.at).toLocaleDateString("it-IT", {
                        timeZone: "Europe/Rome",
                      })}{" "}
                      · {s.minutes.toFixed(1)} min
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {weak.length > 0 && (
        <Panel>
          <h2>Aree da consolidare</h2>
          <p>
            {weak
              .slice(0, 2)
              .map(
                (w) =>
                  `${topics.find((t) => t.id === w.id)?.title}: ${w.accuracy}% su ${w.count} risposte`,
              )
              .join(" · ")}
            . Dati riferiti solo agli esercizi dimostrativi.
          </p>
          <Button variant="outline" onClick={() => go("statistiche")}>
            Analizza i risultati
          </Button>
        </Panel>
      )}
    </>
  );
}
