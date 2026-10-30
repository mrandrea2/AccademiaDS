"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { StudyState } from "./models";
import { emptyState } from "./content";
import { stateSchema } from "./validation";
import { browserSupabase } from "./supabase";
export const STORAGE_KEY = "ds-academy-demo-v1";
export function useWorkspace() {
  const [state, setState] = useState<StudyState>(emptyState);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState("Caricamento…");
  const [error, setError] = useState("");
  const generation = useRef(0);
  const revision = useRef(0);
  const current = useRef(state);
  const persisted = useRef("");
  const blocked = useRef(false);
  const inflight = useRef(false);
  const identity = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    const db = browserSupabase();
    async function load(nextUser: User | null) {
      const requestGeneration = ++generation.current;
      setReady(false);
      blocked.current = false;
      setError("");
      identity.current = nextUser?.id ?? null;
      setUser(nextUser);
      let next = emptyState();
      try {
        if (nextUser) {
          const response = await fetch("/api/workspace");
          if (!response.ok)
            throw new Error(
              "Impossibile caricare l’archivio remoto. Verifica la connessione e le migrations, poi ricarica.",
            );
          const data = await response.json();
          revision.current = data.revision;
          next = data.study_state
            ? stateSchema.parse(data.study_state)
            : emptyState();
        } else {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) next = stateSchema.parse(JSON.parse(saved));
        }
        if (alive && generation.current === requestGeneration) {
          current.current = next;
          persisted.current = JSON.stringify(next);
          setState(next);
          setStatus(
            nextUser
              ? "Archivio privato sincronizzato"
              : "Archivio locale pronto",
          );
          setReady(true);
        }
      } catch (e) {
        if (alive && generation.current === requestGeneration) {
          blocked.current = true;
          setError(e instanceof Error ? e.message : "Archivio non leggibile");
          setStatus("Caricamento interrotto: dati originali conservati");
        }
      }
    }
    if (db) {
      db.auth.getUser().then(({ data }) => {
        if (alive) void load(data.user);
      });
      const {
        data: { subscription },
      } = db.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT")
          setTimeout(() => {
            if (alive && identity.current !== (session?.user.id ?? null))
              void load(session?.user ?? null);
          }, 0);
      });
      return () => {
        alive = false;
        subscription.unsubscribe();
      };
    } else {
      void load(null);
      return () => {
        alive = false;
      };
    }
  }, []);
  useEffect(() => {
    current.current = state;
  }, [state]);
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(async () => {
      const serialized = JSON.stringify(current.current);
      if (
        serialized === persisted.current ||
        inflight.current ||
        blocked.current
      )
        return;
      inflight.current = true;
      const owner = identity.current;
      setStatus("Salvataggio…");
      try {
        if (owner) {
          const response = await fetch("/api/workspace", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              state: current.current,
              ownerId: owner,
              revision: revision.current,
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            if (response.status === 409) blocked.current = true;
            throw new Error(data.error);
          }
          if (identity.current !== owner) return;
          revision.current = data.revision;
        } else {
          localStorage.setItem(STORAGE_KEY, serialized);
        }
        persisted.current = serialized;
        setStatus(
          owner ? "Salvato nell’archivio privato" : "Salvato in questo browser",
        );
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Salvataggio non riuscito");
        setStatus("Modifiche non salvate");
      } finally {
        inflight.current = false;
      }
    }, 800);
    return () => clearInterval(timer);
  }, [ready]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(current.current) !== persisted.current) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, []);
  const update = useCallback((fn: (previous: StudyState) => StudyState) => {
    setStatus("Modifiche da salvare");
    setState((previous) => fn(previous));
  }, []);
  return { state, update, ready, user, status, error };
}
