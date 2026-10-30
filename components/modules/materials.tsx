"use client";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
} from "react";
import {
  Upload,
  FolderSync,
  FileCheck,
  ShieldCheck,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Badge, Empty } from "@/components/shared";
import { browserSupabase, hasSupabase } from "@/lib/supabase";
import { topics } from "@/lib/content";
import {
  BUCKET,
  DOCX_MIME,
  PDF_MIME,
  MAX_FILE_BYTES,
  DRIVE_FOLDER_ID,
  draftBodySchema,
  type MaterialVersion,
  type Segment,
  type TeachingDraft,
} from "@/lib/ingestion/contracts";
interface Overview {
  versions: MaterialVersion[];
  events: { id: string; message: string; level: string; created_at: string }[];
  syncs: {
    id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    discovered: number;
    imported: number;
    skipped: number;
    errors: unknown[];
  }[];
  drafts: TeachingDraft[];
  driveItems: {
    file_id: string;
    name: string;
    status: string;
    last_error: string | null;
  }[];
  total: number;
  offset: number;
  capabilities: {
    driveConfigured: boolean;
    driveConnected: boolean;
    embeddings: boolean;
    ocr: boolean;
  };
}
const labels: Record<string, string> = {
  uploaded: "Da estrarre",
  processing: "Elaborazione in corso",
  needs_ocr: "Pagine da verificare / OCR",
  review: "Revisione richiesta",
  indexing: "Indicizzazione da riprendere",
  indexed: "Indicizzato (privato)",
  error: "Errore",
  duplicate: "Duplicato, copia rimossa",
};
async function api(path: string, body?: unknown, method = "POST") {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Operazione non riuscita.");
  return data;
}
export function Materials() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [segment, setSegment] = useState<
    (Segment & { reviewed: boolean }) | null
  >(null);
  const [segmentCount, setSegmentCount] = useState(0);
  const [ordinal, setOrdinal] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState("");
  const [licensed, setLicensed] = useState(false);
  const [external, setExternal] = useState(false);
  const [kind, setKind] = useState<"quiz" | "flashcard" | "summary" | "case">(
    "summary",
  );
  const [draftText, setDraftText] = useState("");
  const [draftId, setDraftId] = useState("");
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState("");
  const [filter, setFilter] = useState("");
  const pageOffset = useRef(0);
  const reload = useCallback(async () => {
    const data = await api(`/api/materials?offset=${pageOffset.current}`);
    setOverview(data);
    return data as Overview;
  }, []);
  useEffect(() => {
    let alive = true;
    if (!hasSupabase) return;
    fetch("/api/materials")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (alive) setOverview(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  const selected = overview?.versions.find((v) => v.id === selectedId);
  const loadSegment = useCallback(async (id: string, index: number) => {
    const data = await api(
      `/api/materials/review?versionId=${id}&ordinal=${index}`,
    );
    setSegment(data.segment);
    setSegmentCount(data.count ?? 0);
    setTranscription(data.segment?.text ?? "");
    setQuote(String(data.segment?.text ?? "").slice(0, 600));
    setOrdinal(index);
  }, []);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }
  async function process(id: string, mode = "extract") {
    await action(async () => {
      let more = true;
      let batches = 0;
      while (more && batches < 160) {
        const result = await api("/api/materials/process", {
          versionId: id,
          mode,
        });
        more = result.more;
        batches++;
        setMessage(
          `${mode === "extract" ? "Estrazione" : "Embeddings"}: lotto ${batches} completato. ${more ? "Proseguo…" : "Terminato."}`,
        );
        await reload();
      }
      if (more)
        setMessage("Lotti salvati. Riprendi l’elaborazione per continuare.");
      if (mode === "extract") await loadSegment(id, 0);
    });
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action(async () => {
      if (!licensed) throw new Error("Conferma prima i diritti d’uso.");
      const db = browserSupabase();
      if (!db) throw new Error("Supabase non configurato.");
      for (const file of files) {
        const mime = file.name.toLowerCase().endsWith(".pdf")
          ? PDF_MIME
          : file.name.toLowerCase().endsWith(".docx")
            ? DOCX_MIME
            : null;
        if (!mime || file.size > MAX_FILE_BYTES || file.size === 0)
          throw new Error(
            `${file.name}: sono consentiti PDF/DOCX fino a 50 MiB.`,
          );
        setMessage(`Caricamento privato: ${file.name}…`);
        const reservation = await api("/api/materials/upload", {
          fileName: file.name,
          size: file.size,
          mimeType: mime,
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 180),
          materialId: files.length === 1 ? target || undefined : undefined,
          licenseConfirmed: true,
          externalConsent: external,
        });
        const { error } = await db.storage
          .from(BUCKET)
          .upload(reservation.version.storage_path, file, {
            contentType: mime,
            upsert: false,
          });
        if (error) {
          await api(
            "/api/materials/upload",
            { versionId: reservation.version.id },
            "PUT",
          ).catch(() => {});
          throw new Error(
            "Upload non riuscito. Controlla bucket privato, policy e dimensione; elimina la prenotazione incompleta prima di riprovare.",
          );
        }
        setSelectedId(reservation.version.id);
        await reload();
      }
      setMessage(
        "Originali caricati nel bucket privato. Avvia l’estrazione e revisiona prima di indicizzare.",
      );
      setFiles([]);
    });
  }
  async function sync(runId?: string) {
    await action(async () => {
      if (!licensed)
        throw new Error("Conferma i diritti di importazione della cartella.");
      let id = runId;
      if (!id) {
        const result = await api("/api/drive/sync", {
          action: "discover",
          licenseConfirmed: true,
        });
        id = result.runId;
        setMessage(
          `${result.discovered} file trovati; ${result.pending} da acquisire. Nessun numero atteso viene presunto.`,
        );
      }
      let more = true;
      let steps = 0;
      while (more && steps < 1000) {
        const result = await api("/api/drive/sync", {
          action: "next",
          runId: id,
          licenseConfirmed: true,
          externalConsent: external,
        });
        more = result.more;
        steps++;
        setMessage(
          result.file
            ? `Drive: ${result.file} ${result.error ? "— errore registrato" : "— acquisito privatamente"}`
            : "Sincronizzazione terminata. Verifica il riepilogo ed estrai i file acquisiti.",
        );
        await reload();
      }
    });
  }
  function template() {
    const excerpt = quote || "Inserisci una risposta basata sulla fonte";
    const base = {
      title: selected?.materials?.title ?? "Bozza da revisionare",
    };
    setDraftId("");
    setDraftText(
      JSON.stringify(
        kind === "summary"
          ? { kind, ...base, body: excerpt }
          : kind === "flashcard"
            ? {
                kind,
                ...base,
                front: "Quale concetto descrive questo estratto?",
                back: excerpt,
              }
            : kind === "quiz"
              ? {
                  kind,
                  ...base,
                  prompt:
                    "Scrivi una domanda basata sul passaggio selezionato.",
                  options: [
                    { id: "a", text: "Scrivi la risposta corretta" },
                    { id: "b", text: "Scrivi un distrattore plausibile" },
                    { id: "c", text: "Scrivi un altro distrattore" },
                    { id: "d", text: "Scrivi un ultimo distrattore" },
                  ],
                  correctOptionId: "a",
                  explanation: "Motiva la risposta con riferimento alla fonte.",
                }
              : {
                  kind,
                  ...base,
                  scenario:
                    "Caso ipotetico: descrivi un problema realistico coerente con la fonte.",
                  steps: [
                    "Inquadra il problema",
                    "Distingui fatti e ipotesi",
                    "Individua le fonti",
                    "Motiva la decisione",
                    "Verifica gli esiti",
                  ],
                },
        null,
        2,
      ),
    );
    setNote("");
  }
  if (!hasSupabase)
    return (
      <Panel>
        <Empty title="Materiali privati: configura prima Supabase">
          Il caricamento PDF/DOCX richiede un account e storage privato. In demo
          non vengono caricati file, avviata una finta sincronizzazione o
          simulati risultati. Applica le migrations 002 e 003 e abilita il tuo
          account amministratore seguendo docs/materials-setup.md.
        </Empty>
      </Panel>
    );
  return (
    <>
      <p className="notice">
        <ShieldCheck size={18} /> Area amministrativa personale. Originali
        privati, mai nel repository o in cartelle pubbliche Vercel.
        Indicizzazione e approvazione didattica sono due passaggi distinti. Le
        fonti restano non verificate.
      </p>
      {error && (
        <div role="alert" className="error-box">
          {error}
        </div>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!overview ? (
        <Panel>
          <p>
            Account amministratore necessario.{" "}
            {error
              ? "Segui la guida di configurazione e accedi con l’account abilitato."
              : "Verifica accesso in corso…"}
          </p>
          <Button
            variant="outline"
            onClick={() =>
              action(async () => {
                await reload();
              })
            }
          >
            Verifica accesso
          </Button>
        </Panel>
      ) : (
        <>
          <div className="editor-grid">
            <Panel>
              <div className="section-title">
                <Upload size={23} />
                <h2>Carica PDF o DOCX</h2>
              </div>
              <p>
                Massimo 50 MiB per file, fino a 10 file alla volta. Il
                caricamento va direttamente a Supabase Storage, senza
                attraversare il body di una funzione Vercel.
              </p>
              <form className="form-stack" onSubmit={upload}>
                <label>
                  File privati
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    multiple
                    required
                    disabled={busy}
                    onChange={(e) => {
                      const selected = Array.from(e.target.files ?? []);
                      if (selected.length > 10) {
                        setError("Seleziona al massimo 10 file alla volta.");
                        e.target.value = "";
                        setFiles([]);
                      } else setFiles(selected);
                    }}
                  />
                </label>
                <label>
                  Documento da aggiornare
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    disabled={busy || files.length > 1}
                  >
                    <option value="">Nuovo documento per ogni file</option>
                    {Array.from(
                      new Map(
                        overview.versions
                          .filter((v) => v.materials)
                          .map((v) => [v.material_id, v.materials!]),
                      ).values(),
                    ).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={licensed}
                    onChange={(e) => setLicensed(e.target.checked)}
                    required
                  />
                  Confermo i diritti d’uso per questa copia privata e per
                  l’importazione della cartella Drive.
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={external}
                    onChange={(e) => setExternal(e.target.checked)}
                  />
                  Acconsento all’invio al provider configurato per OCR,
                  embeddings e generazione AI. Facoltativo.
                </label>
                <Button
                  type="submit"
                  disabled={busy || !licensed || !files.length}
                >
                  <Upload size={18} />
                  {busy ? "Operazione in corso…" : "Carica in storage privato"}
                </Button>
              </form>
            </Panel>
            <Panel>
              <div className="section-title">
                <FolderSync size={23} />
                <h2>Google Drive</h2>
              </div>
              <p>PREPARAZIONE CONCORSO DIRIGENTE 2027</p>
              <small className="preserve">Cartella: {DRIVE_FOLDER_ID}</small>
              <p className="notice">
                L’app usa una propria autorizzazione Google. Lo scope di sola
                lettura consente tecnicamente la lettura Drive; l’app limita le
                richieste ai file figli diretti di questa cartella. Nessuna
                scansione di altre cartelle o sottocartelle.
              </p>
              <Badge>
                {!overview.capabilities.driveConfigured
                  ? "Credenziali OAuth mancanti"
                  : overview.capabilities.driveConnected
                    ? "Account Google autorizzato"
                    : "Configurato, autorizzazione mancante"}
              </Badge>
              <div className="inline-actions material-actions">
                {overview.capabilities.driveConfigured &&
                  !overview.capabilities.driveConnected && (
                    <Button asChild>
                      <a href="/api/drive/connect">Autorizza Google Drive</a>
                    </Button>
                  )}
                {overview.capabilities.driveConnected && (
                  <>
                    <Button disabled={busy || !licensed} onClick={() => sync()}>
                      <FolderSync size={18} />
                      Sincronizza manualmente
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          await api("/api/drive/disconnect", {});
                          setMessage(
                            "Autorizzazione Drive revocata. Le copie private già importate sono conservate.",
                          );
                        })
                      }
                    >
                      Disconnetti e revoca
                    </Button>
                  </>
                )}
              </div>
              {!overview.capabilities.driveConfigured && (
                <p>
                  Segui docs/google-drive-oauth.md. Nessuna sincronizzazione è
                  stata attivata.
                </p>
              )}
              {overview.syncs.map((run) => (
                <div key={run.id} className="material-run">
                  <strong>
                    {run.status === "complete"
                      ? "Ultima sincronizzazione conclusa"
                      : run.status === "running"
                        ? "Sincronizzazione da completare"
                        : "Sincronizzazione interrotta"}
                  </strong>
                  <p>
                    {new Date(run.finished_at ?? run.started_at).toLocaleString(
                      "it-IT",
                    )}{" "}
                    · {run.discovered} trovati · {run.imported} acquisiti ·{" "}
                    {run.skipped} invariati/non supportati · {run.errors.length}{" "}
                    errori
                  </p>
                  {run.status === "running" && (
                    <div className="inline-actions">
                      <Button
                        variant="outline"
                        disabled={busy || !licensed}
                        onClick={() => sync(run.id)}
                      >
                        Riprendi sincronizzazione
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            await api("/api/drive/sync", {
                              action: "cancel",
                              runId: run.id,
                              licenseConfirmed: true,
                            });
                          })
                        }
                      >
                        Annulla sincronizzazione
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </Panel>
          </div>
          <Panel>
            <div className="section-header">
              <div>
                <h2>Stato importazioni e fonti</h2>
                <p>
                  {overview.total} versioni ·{" "}
                  {
                    overview.versions.filter(
                      (v) => v.materials?.verification === "unverified",
                    ).length
                  }{" "}
                  versioni di fonti non verificate nella pagina corrente
                </p>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    await reload();
                  })
                }
              >
                <RefreshCw size={17} />
                Aggiorna
              </Button>
            </div>
            <label>
              Cerca titolo o stato
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtra le importazioni…"
              />
            </label>
            <div className="material-list">
              {overview.versions
                .filter((v) =>
                  `${v.file_name} ${v.status} ${labels[v.status]}`
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )
                .map((v) => (
                  <button
                    key={v.id}
                    className={`material-row ${selectedId === v.id ? "is-selected" : ""}`}
                    onClick={() =>
                      action(async () => {
                        setSelectedId(v.id);
                        setDraftText("");
                        await loadSegment(v.id, 0);
                      })
                    }
                    disabled={busy}
                  >
                    <FileCheck size={22} />
                    <span>
                      <strong>{v.materials?.title ?? v.file_name}</strong>
                      <small>
                        Versione {v.version} ·{" "}
                        {(v.byte_size / 1024 / 1024).toFixed(2)} MiB ·{" "}
                        {labels[v.status]} ·{" "}
                        {v.sha256
                          ? `SHA-256 ${v.sha256.slice(0, 12)}…`
                          : "Hash da calcolare"}
                      </small>
                    </span>
                    <Badge>
                      {v.materials?.area
                        ? topics.find((t) => t.id === v.materials?.area)?.title
                        : "Area da classificare"}
                    </Badge>
                  </button>
                ))}
            </div>
            {!overview.versions.length && (
              <Empty title="Nessun originale importato">
                Carica i tuoi manuali o configura Google Drive. Non sono stati
                importati automaticamente i 38 file indicati.
              </Empty>
            )}
            {overview.total > 100 && (
              <div className="inline-actions">
                <Button
                  variant="outline"
                  disabled={busy || overview.offset === 0}
                  onClick={() =>
                    action(async () => {
                      const data = await api(
                        `/api/materials?offset=${Math.max(0, overview.offset - 100)}`,
                      );
                      pageOffset.current = data.offset ?? 0;
                      setOverview(data);
                    })
                  }
                >
                  Pagina precedente
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || overview.offset + 100 >= overview.total}
                  onClick={() =>
                    action(async () => {
                      const data = await api(
                        `/api/materials?offset=${overview.offset + 100}`,
                      );
                      pageOffset.current = data.offset ?? 0;
                      setOverview(data);
                    })
                  }
                >
                  Pagina successiva
                </Button>
              </div>
            )}
          </Panel>
          {selected && (
            <Panel>
              <h2>
                {selected.materials?.title} · versione {selected.version}
              </h2>
              <Badge>{labels[selected.status]}</Badge>
              {selected.error_message && (
                <p className="error-box">{selected.error_message}</p>
              )}
              <p>
                {selected.page_count
                  ? `${selected.page_count} pagine fisiche PDF`
                  : selected.mime_type === DOCX_MIME
                    ? "DOCX: riferimenti per sezione, nessuna pagina inventata"
                    : "PDF: paginazione da determinare"}{" "}
                · cursore {selected.cursor} ·{" "}
                {selected.embedding_model
                  ? "Embeddings completati"
                  : "Indice semantico non completato"}
              </p>
              {selected.warnings.length > 0 && (
                <details>
                  <summary>
                    Avvisi di estrazione ({selected.warnings.length})
                  </summary>
                  <ul>
                    {selected.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="form-grid">
                <label>
                  Area di studio (modificabile)
                  <select
                    value={selected.materials?.area ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      action(async () => {
                        await api("/api/materials/review", {
                          versionId: selected.id,
                          action: "classify",
                          area: e.target.value,
                        });
                      })
                    }
                  >
                    <option value="" disabled>
                      Da classificare
                    </option>
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
                    checked={selected.materials?.external_consent ?? false}
                    disabled={busy}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      if (
                        confirm(
                          enabled
                            ? "Consentire l’elaborazione esterna dei materiali selezionati?"
                            : "Revocare il consenso esterno e rimuovere gli embeddings già salvati?",
                        )
                      )
                        void action(async () => {
                          await api("/api/materials/review", {
                            versionId: selected.id,
                            action: "consent",
                            externalConsent: enabled,
                          });
                        });
                    }}
                  />
                  Consenso esterno per questo documento (OCR / embeddings / AI)
                </label>
              </div>
              <div className="inline-actions material-actions">
                {["uploaded", "processing"].includes(selected.status) && (
                  <Button disabled={busy} onClick={() => process(selected.id)}>
                    Estrai / riprendi a lotti
                  </Button>
                )}
                {["error", "processing"].includes(selected.status) && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        await api("/api/materials/review", {
                          versionId: selected.id,
                          action: "retry",
                        });
                        setMessage(
                          "Lavoro ripristinato. Avvia nuovamente l’estrazione.",
                        );
                      })
                    }
                  >
                    Riprova lavoro
                  </Button>
                )}
                {["review", "needs_ocr", "indexing"].includes(
                  selected.status,
                ) && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        await api("/api/materials/review", {
                          versionId: selected.id,
                          action: "approve",
                        });
                        setMessage(
                          "Estrazione approvata e indice full-text privato aggiornato. La fonte resta non verificata.",
                        );
                      })
                    }
                  >
                    Approva estrazione e indicizza
                  </Button>
                )}
                {["needs_ocr", "review"].includes(selected.status) && (
                  <Button
                    variant="outline"
                    disabled={
                      busy ||
                      !overview.capabilities.ocr ||
                      !selected.materials?.external_consent
                    }
                    onClick={() =>
                      action(async () => {
                        await api("/api/materials/review", {
                          versionId: selected.id,
                          action: "ocr",
                        });
                        await loadSegment(selected.id, ordinal);
                        setMessage(
                          "OCR eseguito su un lotto di massimo cinque pagine. Revisiona le trascrizioni e ripeti per le pagine restanti.",
                        );
                      })
                    }
                  >
                    OCR esterno (opzionale)
                  </Button>
                )}
                {selected.status === "indexed" && (
                  <Button
                    variant="outline"
                    disabled={
                      busy ||
                      !overview.capabilities.embeddings ||
                      !selected.materials?.external_consent
                    }
                    onClick={() => process(selected.id, "embed")}
                  >
                    Indicizza semanticamente / riprendi
                  </Button>
                )}
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Eliminare originale, indice, segmenti e bozze di questa versione?",
                      )
                    )
                      void action(async () => {
                        await api(
                          `/api/materials?id=${selected.id}`,
                          {},
                          "DELETE",
                        );
                        setSelectedId("");
                        setSegment(null);
                      });
                  }}
                >
                  <Trash2 size={17} />
                  Elimina versione privata
                </Button>
              </div>
              <p className="source-note">
                OCR:{" "}
                {overview.capabilities.ocr
                  ? "servizio esterno configurato"
                  : "non configurato; puoi inserire una trascrizione manuale"}
                . Embeddings:{" "}
                {overview.capabilities.embeddings
                  ? "provider configurato, consenso richiesto"
                  : "non configurati; full-text disponibile dopo approvazione"}
                .
              </p>
              {segment && (
                <div className="material-review">
                  <div className="section-header">
                    <h3>
                      Revisione estrazione ·{" "}
                      {segment.page
                        ? `pagina ${segment.page}`
                        : `sezione ${segment.section}`}{" "}
                      · {ordinal + 1}/{segmentCount}
                    </h3>
                    <Badge>
                      {segment.kind === "ocr"
                        ? "OCR da revisionare"
                        : segment.kind === "table"
                          ? "Tabella in testo"
                          : "Testo estratto"}
                    </Badge>
                  </div>
                  <label>
                    Trascrizione della pagina/sezione privata
                    <textarea
                      rows={8}
                      value={transcription}
                      maxLength={100000}
                      readOnly={
                        !["review", "needs_ocr"].includes(selected.status)
                      }
                      onChange={(e) => setTranscription(e.target.value)}
                    />
                  </label>
                  <div className="inline-actions">
                    <Button
                      variant="outline"
                      disabled={busy || ordinal === 0}
                      onClick={() =>
                        action(async () =>
                          loadSegment(selected.id, ordinal - 1),
                        )
                      }
                    >
                      Precedente
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || ordinal + 1 >= segmentCount}
                      onClick={() =>
                        action(async () =>
                          loadSegment(selected.id, ordinal + 1),
                        )
                      }
                    >
                      Successiva
                    </Button>
                    {["review", "needs_ocr"].includes(selected.status) && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            await api("/api/materials/review", {
                              versionId: selected.id,
                              action: "edit",
                              segment: { ordinal, text: transcription },
                            });
                            await loadSegment(selected.id, ordinal);
                            setMessage(
                              "Trascrizione confermata manualmente. Una pagina vuota confermata non viene indicizzata.",
                            );
                          })
                        }
                      >
                        Conferma trascrizione / pagina bianca
                      </Button>
                    )}
                  </div>
                  <p className="source-note">
                    L’approvazione dell’estrazione non certifica la validità
                    normativa. Confronta con l’originale in tuo possesso; nessun
                    link di download pubblico viene creato.
                  </p>
                </div>
              )}
              {selected.status === "indexed" && segment && (
                <div className="material-review">
                  <h3>Bozza didattica con approvazione obbligatoria</h3>
                  <div className="form-grid">
                    <label>
                      Tipo
                      <select
                        value={kind}
                        onChange={(e) => setKind(e.target.value as typeof kind)}
                      >
                        <option value="summary">Sintesi</option>
                        <option value="quiz">Quiz</option>
                        <option value="flashcard">Flashcard</option>
                        <option value="case">Caso</option>
                      </select>
                    </label>
                  </div>
                  <div className="inline-actions">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={template}
                    >
                      Prepara bozza manuale modificabile
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        busy ||
                        !overview.capabilities.embeddings ||
                        !selected.materials?.external_consent
                      }
                      onClick={() =>
                        action(async () => {
                          const data = await api("/api/materials/generate", {
                            versionId: selected.id,
                            segmentOrdinal: ordinal,
                            kind,
                          });
                          setDraftText(
                            JSON.stringify(data.draft.body, null, 2),
                          );
                          setDraftId(data.draft.id);
                          setMessage(
                            "Bozza generata da AI, non pubblicata. Verifica contenuti e citazioni.",
                          );
                        })
                      }
                    >
                      Genera bozza AI (facoltativo)
                    </Button>
                  </div>
                  {draftText && (
                    <>
                      <label>
                        Contenuto strutturato JSON (tutti i campi modificabili)
                        <textarea
                          rows={12}
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                        />
                      </label>
                      <label>
                        Citazione esatta dal segmento (10–600 caratteri)
                        <textarea
                          rows={4}
                          value={quote}
                          minLength={10}
                          maxLength={600}
                          onChange={(e) => setQuote(e.target.value)}
                          readOnly={Boolean(draftId)}
                        />
                      </label>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            const body = draftBodySchema.parse(
                              JSON.parse(draftText),
                            );
                            if (draftId)
                              await api(
                                "/api/materials/drafts",
                                { id: draftId, action: "edit", body },
                                "PUT",
                              );
                            else {
                              const result = await api(
                                "/api/materials/drafts",
                                {
                                  versionId: selected.id,
                                  body,
                                  citations: [
                                    { segmentOrdinal: ordinal, quote },
                                  ],
                                },
                              );
                              setDraftId(result.draft.id);
                            }
                            setMessage(
                              "Bozza salvata. Non visibile nei percorsi finché non approvata.",
                            );
                          })
                        }
                      >
                        Salva come bozza da revisionare
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Panel>
          )}
          <Panel>
            <h2>Revisione e pubblicazione didattica privata</h2>
            <p>
              Solo le bozze approvate compariranno nei tuoi strumenti di studio.
              Nessuna pubblicazione verso altri utenti o sul web. Le citazioni
              non attestano la correttezza delle conclusioni.
            </p>
            <label>
              Nota del revisore (almeno 10 caratteri)
              <textarea
                value={note}
                minLength={10}
                maxLength={2000}
                rows={2}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Indica controlli effettuati e limiti della bozza…"
              />
            </label>
            {overview.drafts.length ? (
              overview.drafts.map((d) => (
                <article className="draft-card" key={d.id}>
                  <div className="section-header">
                    <h3>{d.body.title}</h3>
                    <Badge>
                      {d.status === "approved"
                        ? "Approvata"
                        : d.status === "rejected"
                          ? "Respinta"
                          : "Da revisionare"}{" "}
                      · {d.provenance === "ai" ? "Generata da AI" : "Personale"}
                    </Badge>
                  </div>
                  <details>
                    <summary>Leggi contenuto e citazioni</summary>
                    <pre className="preserve">
                      {JSON.stringify(d.body, null, 2)}
                    </pre>
                    {d.citations.map((c, i) => (
                      <blockquote key={i} className="preserve">
                        Segmento {c.segmentOrdinal + 1}: {c.quote}
                      </blockquote>
                    ))}
                    {d.review_note && <p>Nota: {d.review_note}</p>}
                  </details>
                  <div className="inline-actions">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setSelectedId(d.version_id);
                        setDraftId(d.id);
                        setDraftText(JSON.stringify(d.body, null, 2));
                        setQuote(d.citations[0]?.quote ?? "");
                        void action(async () =>
                          loadSegment(
                            d.version_id,
                            d.citations[0]?.segmentOrdinal ?? 0,
                          ),
                        );
                      }}
                    >
                      Apri e modifica bozza
                    </Button>
                    <Button
                      disabled={
                        busy ||
                        note.trim().length < 10 ||
                        d.status === "approved"
                      }
                      onClick={() =>
                        action(async () => {
                          await api(
                            "/api/materials/drafts",
                            { id: d.id, action: "approve", reviewNote: note },
                            "PUT",
                          );
                          setMessage(
                            "Contenuto approvato per il tuo studio privato. Apri il modulo pertinente per utilizzarlo.",
                          );
                        })
                      }
                    >
                      Approva per lo studio privato
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || note.trim().length < 10}
                      onClick={() =>
                        action(async () => {
                          await api(
                            "/api/materials/drafts",
                            { id: d.id, action: "reject", reviewNote: note },
                            "PUT",
                          );
                        })
                      }
                    >
                      Respingi / ritira
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <p>Nessuna bozza creata.</p>
            )}
          </Panel>
          <Panel>
            <h2>Registro acquisizioni ed errori</h2>
            {overview.events.map((e) => (
              <p key={e.id}>
                <Badge>{e.level}</Badge>{" "}
                {new Date(e.created_at).toLocaleString("it-IT")} · {e.message}
              </p>
            ))}
            {overview.driveItems
              .filter((i) => i.last_error)
              .map((i) => (
                <p key={i.file_id}>
                  {i.name}: {i.last_error}
                </p>
              ))}
            {!overview.events.length && (
              <p>Nessun evento: importa prima un materiale.</p>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
