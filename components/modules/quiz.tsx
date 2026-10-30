"use client";
import { useCurated } from "@/lib/use-curated";
import { questions as demoQuestions, topics } from "@/lib/content";
import { accuracy, prepareQuestions } from "@/lib/learning";
import type { Attempt, Question, StudyState } from "@/lib/models";
import { ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import {
  Badge,
  Panel,
  Progress,
  Provenance,
  addSession,
  type Update,
} from "@/components/shared";
export function Quiz({ state, update }: { state: StudyState; update: Update }) {
  const curated = useCurated();
  const questions = [...demoQuestions, ...curated.questions];
  const [area, setArea] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [mode, setMode] = useState("allenamento");
  const [run, setRun] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [results, setResults] = useState<Attempt[]>([]);
  const [done, setDone] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const deadline = useRef(0);
  const started = useRef(0);
  const sessionStart = useRef(0);
  const finalized = useRef(false);
  const question = run[index];
  const latest = new Map<string, Attempt>();
  [...state.attempts]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .forEach((a) => latest.set(a.questionId, a));
  const pool = questions.filter(
    (q) =>
      (!area || q.topicId === area) &&
      (!difficulty || q.difficulty === difficulty) &&
      (mode !== "errori" || latest.get(q.id)?.correct === false),
  );
  function finish() {
    if (finalized.current) return;
    finalized.current = true;
    setDone(true);
    update((s) =>
      addSession(
        s,
        "quiz",
        mode === "simulazione"
          ? "Simulazione dimostrativa"
          : "Allenamento quiz",
        (Date.now() - sessionStart.current) / 60000,
      ),
    );
  }
  useEffect(() => {
    if (!run.length || done || mode !== "simulazione") return;
    const timer = setInterval(
      () =>
        setRemaining(() =>
          Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)),
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, [run.length, done, mode]);
  useEffect(() => {
    if (run.length && !done && mode === "simulazione" && remaining === 0) {
      const timeout = setTimeout(() => {
        if (!finalized.current) {
          finalized.current = true;
          setDone(true);
          update((s) =>
            addSession(
              s,
              "quiz",
              "Simulazione: tempo terminato",
              (Date.now() - sessionStart.current) / 60000,
            ),
          );
        }
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [remaining, run.length, done, mode, update]);
  function start() {
    const qs = prepareQuestions(
      pool,
      mode === "simulazione" ? state.simulation.count : pool.length,
    );
    setRun(qs);
    setIndex(0);
    setSelected("");
    setConfirmed(false);
    setResults([]);
    setDone(false);
    finalized.current = false;
    started.current = Date.now();
    sessionStart.current = Date.now();
    deadline.current = Date.now() + state.simulation.minutes * 60000;
    setRemaining(state.simulation.minutes * 60);
  }
  function submit() {
    if (!selected || confirmed) return;
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      questionId: question.id,
      topicId: question.topicId,
      selectedOptionId: selected,
      correct: selected === question.correctOptionId,
      seconds: Math.round((Date.now() - started.current) / 1000),
      at: new Date().toISOString(),
    };
    setResults((r) => [...r, attempt]);
    update((s) => ({ ...s, attempts: [...s.attempts, attempt] }));
    setConfirmed(true);
  }
  const score =
    results.filter((r) => r.correct).length * state.simulation.correct +
    results.filter((r) => !r.correct).length * state.simulation.wrong +
    (run.length - results.length) * state.simulation.blank;
  return (
    <>
      <p className="notice">
        Quesiti demo e bozze personali approvate, distinguibili per provenienza.
        Non domande ufficiali né una banca dati di preparazione normativa. La
        simulazione segue i parametri personali impostati, non un regolamento
        d’esame certificato.
      </p>
      {!run.length ? (
        <Panel>
          <h2>Come vuoi allenarti?</h2>
          <div className="form-grid">
            <label>
              Modalità
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="allenamento">Allenamento</option>
                <option value="simulazione">Simulazione configurabile</option>
                <option value="errori">Errori più recenti</option>
              </select>
            </label>
            <label>
              Area
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">Tutte le aree</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Difficoltà
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="">Tutti i livelli</option>
                {["base", "intermedia", "avanzata"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>
          {mode === "simulazione" && (
            <div className="form-grid">
              {(
                [
                  {
                    key: "count",
                    label: "Numero di quesiti",
                    min: 1,
                    max: 100,
                  },
                  {
                    key: "minutes",
                    label: "Durata (minuti)",
                    min: 1,
                    max: 240,
                  },
                  {
                    key: "correct",
                    label: "Punti risposta corretta",
                    min: -10,
                    max: 10,
                  },
                  {
                    key: "wrong",
                    label: "Punti risposta errata",
                    min: -10,
                    max: 10,
                  },
                  {
                    key: "blank",
                    label: "Punti risposta omessa",
                    min: -10,
                    max: 10,
                  },
                ] as const
              ).map((f) => (
                <label key={f.key}>
                  {f.label}
                  <input
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.key === "count" || f.key === "minutes" ? 1 : 0.25}
                    value={state.simulation[f.key]}
                    onChange={(e) => {
                      const n = e.target.valueAsNumber;
                      if (Number.isFinite(n) && n >= f.min && n <= f.max)
                        update((s) => ({
                          ...s,
                          simulation: { ...s.simulation, [f.key]: n },
                        }));
                    }}
                  />
                </label>
              ))}
            </div>
          )}
          <p>
            {pool.length} quesiti disponibili
            {mode === "simulazione"
              ? ` · verranno proposti ${Math.min(pool.length, state.simulation.count)} quesiti`
              : ""}
            .
          </p>
          <Button disabled={!pool.length} onClick={start}>
            Inizia sessione <ArrowRight size={17} />
          </Button>
          {!pool.length && (
            <p>
              Nessun quesito con questi filtri. In modalità errori vengono
              inclusi solo i quesiti la cui ultima risposta è errata.
            </p>
          )}
        </Panel>
      ) : done ? (
        <Panel>
          <Badge>Sessione conclusa</Badge>
          <h2>
            {results.filter((r) => r.correct).length} risposte corrette su{" "}
            {run.length}
          </h2>
          <p>
            {results.length} risposte date · {run.length - results.length}{" "}
            omesse · accuratezza sulle risposte: {accuracy(results)}%
          </p>
          {mode === "simulazione" && (
            <p>
              Punteggio personale: {score}. Nessuna soglia ufficiale applicata.
            </p>
          )}
          <ul>
            {results.map((r) => (
              <li key={r.id}>
                {r.correct ? "✓" : "×"}{" "}
                {questions.find((q) => q.id === r.questionId)?.prompt} ·{" "}
                {r.seconds} s
              </li>
            ))}
          </ul>
          <Button onClick={() => setRun([])}>Nuova sessione</Button>
        </Panel>
      ) : (
        <Panel>
          <div className="section-header">
            <Badge>
              Quesito {index + 1} di {run.length}
            </Badge>
            {mode === "simulazione" && (
              <span role="timer">
                {Math.floor(remaining / 60)}:
                {String(remaining % 60).padStart(2, "0")}
              </span>
            )}
            <Button variant="ghost" onClick={finish}>
              Termina sessione
            </Button>
          </div>
          <Progress
            label="Avanzamento quiz"
            value={(index / run.length) * 100}
          />
          <h2 className="question">{question.prompt}</h2>
          <fieldset disabled={confirmed}>
            <legend className="sr-only">Scegli una risposta</legend>
            {question.options.map((option, i) => (
              <label
                key={option.id}
                className={`answer ${selected === option.id ? "selected" : ""} ${confirmed && option.id === question.correctOptionId ? "correct" : ""}`}
              >
                <input
                  type="radio"
                  name="answer"
                  value={option.id}
                  checked={selected === option.id}
                  onChange={() => setSelected(option.id)}
                />
                <span className="answer-letter">
                  {String.fromCharCode(65 + i)}
                </span>
                {option.text}
                {confirmed && option.id === question.correctOptionId && (
                  <Check size={18} />
                )}
              </label>
            ))}
          </fieldset>
          {confirmed && (
            <div className="feedback" role="status">
              <h3>
                {selected === question.correctOptionId
                  ? "Risposta corretta"
                  : "Rivediamo il ragionamento"}
              </h3>
              <p>{question.explanation}</p>
              <Provenance source={question.source} />
            </div>
          )}
          <div className="inline-actions">
            {!confirmed ? (
              <Button disabled={!selected} onClick={submit}>
                Conferma risposta
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (index === run.length - 1) {
                    finish();
                  } else {
                    setIndex(index + 1);
                    setSelected("");
                    setConfirmed(false);
                    started.current = Date.now();
                  }
                }}
              >
                {index === run.length - 1
                  ? "Vedi risultati"
                  : "Prossima domanda"}{" "}
                <ArrowRight size={17} />
              </Button>
            )}
            {mode === "simulazione" && !confirmed && (
              <Button
                variant="outline"
                onClick={() => {
                  if (index === run.length - 1) finish();
                  else {
                    setIndex(index + 1);
                    setSelected("");
                    started.current = Date.now();
                  }
                }}
              >
                Ometti risposta
              </Button>
            )}
          </div>
        </Panel>
      )}
    </>
  );
}
