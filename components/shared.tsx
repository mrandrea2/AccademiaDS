"use client";
import type { SourceRef } from "@/lib/models";
import type { StudyState } from "@/lib/models";
import { BookOpen, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export function useClock() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 60000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);
  return now;
}
export type Update = (fn: (s: StudyState) => StudyState) => void;
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <BookOpen size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function Provenance({ source }: { source?: SourceRef }) {
  const demo = !source || source.provenance === "demo";
  return (
    <>
      <p className="source-note">
        <ShieldCheck size={15} />
        {demo
          ? "Contenuto dimostrativo"
          : source.provenance === "ai"
            ? "Generato da AI · approvato per studio privato"
            : "Contenuto personale · approvato per studio privato"}{" "}
        ·{" "}
        {source?.verification === "verified"
          ? "verifica personale registrata"
          : "fonte non verificata"}{" "}
        · versione {source?.version ?? "demo-1"} · non ufficiale
      </p>
      {source?.documentId && (
        <details>
          <summary>
            Fonte: {source.title ?? source.documentId} ·{" "}
            {source.page
              ? `pagina ${source.page}`
              : (source.section ?? "sezione da verificare")}{" "}
            · versione {source.version}
          </summary>
          {source.quote && (
            <blockquote className="preserve">{source.quote}</blockquote>
          )}
        </details>
      )}
    </>
  );
}
export function addSession(
  s: StudyState,
  kind: StudyState["sessions"][number]["kind"],
  label: string,
  minutes: number,
  topicId?: string,
): StudyState {
  return {
    ...s,
    sessions: [
      {
        id: crypto.randomUUID(),
        kind,
        label,
        minutes,
        topicId,
        at: new Date().toISOString(),
      },
      ...s.sessions,
    ],
  };
}
export function exportJson(state: StudyState) {
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          {
            format: "ds-academy-v1",
            exportedAt: new Date().toISOString(),
            state,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "ds-academy-esportazione.json";
  a.click();
  URL.revokeObjectURL(url);
}
