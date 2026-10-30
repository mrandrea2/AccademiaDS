"use client";
import { cases } from "@/lib/content";
import type { StudyState } from "@/lib/models";
import { Download, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import {
  Panel,
  Provenance,
  addSession,
  type Update,
} from "@/components/shared";
export function Oral({ state, update }: { state: StudyState; update: Update }) {
  const [caseId, setCaseId] = useState(cases[0].id);
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState("");
  const [message, setMessage] = useState("");
  const ratings = state.oralRatings;
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const url = useRef("");
  const started = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);
  async function record() {
    setMessage("");
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      !window.MediaRecorder
    ) {
      setMessage(
        "Registrazione non disponibile in questo browser o contesto. Usa le note testuali.",
      );
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const rec = new MediaRecorder(media);
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        if (!mounted.current) return;
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = URL.createObjectURL(
          new Blob(chunks, { type: rec.mimeType }),
        );
        setAudio(url.current);
        setRecording(false);
        update((s) =>
          addSession(
            s,
            "oral",
            "Esercitazione orale",
            (Date.now() - started.current) / 60000,
          ),
        );
      };
      rec.start();
      started.current = Date.now();
      setRecording(true);
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      setMessage(
        "Autorizzazione al microfono negata o dispositivo non disponibile. Puoi esercitarti con le note.",
      );
    }
  }
  return (
    <div className="editor-grid">
      <Panel>
        <label>
          Caso da discutere
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <p className="scenario">
          {cases.find((c) => c.id === caseId)?.scenario}
        </p>
        <Provenance />
        <h3>Cinque passi per la soluzione</h3>
        <ol className="steps">
          {[
            "Descrivi il problema e il contesto.",
            "Distingui fatti, ipotesi e informazioni mancanti.",
            "Individua fonti e soggetti da coinvolgere.",
            "Confronta le opzioni e motiva la scelta.",
            "Definisci azioni, tempi e indicatori di verifica.",
          ].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <label>
          Note e trascrizione manuale (opzionale)
          <textarea
            rows={8}
            value={state.oralNotes}
            maxLength={100000}
            onChange={(e) =>
              update((s) => ({ ...s, oralNotes: e.target.value }))
            }
          />
        </label>
        <Button
          variant="outline"
          onClick={() => {
            update((s) => addSession(s, "oral", "Autovalutazione orale", 0));
            setMessage("Autovalutazione annotata nell’attività recente.");
          }}
        >
          Registra sessione di studio
        </Button>
      </Panel>
      <div className="stack">
        <Panel>
          <h2>Ascolta la tua esposizione</h2>
          <p>
            Il microfono viene richiesto solo dopo il tuo clic. Audio temporaneo
            in memoria, mai caricato; scaricalo prima di lasciare la pagina.
            Nessuna trascrizione automatica attiva.
          </p>
          {recording ? (
            <Button
              variant="destructive"
              onClick={() => recorder.current?.stop()}
            >
              Interrompi registrazione
            </Button>
          ) : (
            <Button onClick={record}>
              <Mic size={18} />
              Autorizza e registra
            </Button>
          )}
          <p role="status">{recording ? "Registrazione in corso…" : message}</p>
          {audio && (
            <>
              <audio
                controls
                src={audio}
                aria-label="Registrazione della prova orale"
              />
              <a className="text-link" href={audio} download="prova-orale.webm">
                Scarica audio <Download size={16} />
              </a>
              <Button
                variant="ghost"
                onClick={() => {
                  URL.revokeObjectURL(url.current);
                  url.current = "";
                  setAudio("");
                }}
              >
                Elimina audio
              </Button>
            </>
          )}
        </Panel>
        <Panel>
          <h2>Autovalutazione</h2>
          <p>Da 1 (da sviluppare) a 5 (solido). Nessun punteggio ufficiale.</p>
          {[
            "Chiarezza",
            "Analisi del contesto",
            "Uso delle fonti",
            "Decisione motivata",
            "Verifica degli esiti",
          ].map((label, i) => (
            <label key={label}>
              {label}
              <select
                value={ratings[i]}
                onChange={(e) =>
                  update((s) => ({
                    ...s,
                    oralRatings: s.oralRatings.map((v, n) =>
                      n === i ? Number(e.target.value) : v,
                    ),
                  }))
                }
              >
                <option value={0}>Da valutare</option>
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
        </Panel>
      </div>
    </div>
  );
}
