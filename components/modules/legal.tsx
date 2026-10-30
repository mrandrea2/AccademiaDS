"use client";
import type { StudyState } from "@/lib/models";
import { ArrowUpRight, Plus, Scale, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import { Badge, Empty, Panel, type Update } from "@/components/shared";
export function Legal({
  state,
  update,
}: {
  state: StudyState;
  update: Update;
}) {
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <p className="notice">
        Nessun articolo è validato dalla piattaforma. Registra gli estremi delle
        fonti che consulti e la tua verifica personale. Uno stato «verificato» è
        una tua annotazione, non una certificazione della vigenza.
      </p>
      <div className="toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            placeholder="Cerca fonte, articolo o versione…"
            aria-label="Cerca fonte normativa"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
        <Button onClick={() => setAdding(!adding)}>
          <Plus size={18} />
          {adding ? "Chiudi modulo" : "Registra fonte normativa"}
        </Button>
      </div>
      {adding && (
        <Panel>
          <h2>Estremi della fonte</h2>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const url = String(data.get("url"));
              try {
                if (new URL(url).protocol !== "https:") throw new Error();
              } catch {
                setError(
                  "Inserisci un indirizzo HTTPS valido della fonte originale.",
                );
                return;
              }
              const source = {
                id: crypto.randomUUID(),
                title: String(data.get("title")),
                url,
                article: String(data.get("article")) || null,
                effective_date: String(data.get("date")) || null,
                verification: "unverified" as const,
                version: String(data.get("version")),
                history: [
                  `${new Date().toISOString()} · Fonte registrata, non verificata`,
                ],
              };
              update((s) => ({
                ...s,
                legalSources: [source, ...s.legalSources],
              }));
              setAdding(false);
              setError("");
            }}
          >
            <label>
              Titolo dell’atto
              <input name="title" required minLength={3} maxLength={180} />
            </label>
            <label>
              Collegamento alla fonte originale
              <input type="url" name="url" required placeholder="https://…" />
            </label>
            <div className="form-grid">
              <label>
                Articolo o sezione
                <input name="article" maxLength={150} />
              </label>
              <label>
                Data dell’atto
                <input type="date" name="date" />
              </label>
              <label>
                Versione consultata
                <input
                  name="version"
                  required
                  maxLength={100}
                  placeholder="Indica la versione, senza presumerne la vigenza"
                />
              </label>
            </div>
            <Button type="submit">Salva fonte</Button>
          </form>
        </Panel>
      )}
      {error && <p role="alert">{error}</p>}
      {state.legalSources.length > 0 ? (
        <div className="catalog-grid">
          {state.legalSources
            .filter((s) =>
              `${s.title} ${s.article} ${s.version}`
                .toLowerCase()
                .includes(filter.toLowerCase()),
            )
            .map((source) => (
              <Panel key={source.id}>
                <Badge>Annotazione personale</Badge>
                <h2>{source.title}</h2>
                <dl>
                  <dt>Articolo</dt>
                  <dd>{source.article || "Non specificato"}</dd>
                  <dt>Data dell’atto</dt>
                  <dd>{source.effective_date || "Non specificata"}</dd>
                  <dt>Versione</dt>
                  <dd>{source.version}</dd>
                </dl>
                <label>
                  Stato di verifica personale
                  <select
                    value={source.verification}
                    onChange={(e) => {
                      const verification = e.target
                        .value as typeof source.verification;
                      update((s) => ({
                        ...s,
                        legalSources: s.legalSources.map((v) =>
                          v.id === source.id
                            ? {
                                ...v,
                                verification,
                                history: [
                                  ...v.history,
                                  `${new Date().toISOString()} · Stato personale: ${verification}`,
                                ],
                              }
                            : v,
                        ),
                      }));
                    }}
                  >
                    <option value="unverified">Non verificata</option>
                    <option value="verified">Verificata da me</option>
                    <option value="outdated">Da aggiornare</option>
                  </select>
                </label>
                <label>
                  Aggiorna versione
                  <input
                    defaultValue={source.version}
                    maxLength={100}
                    onBlur={(e) => {
                      const version = e.target.value.trim();
                      if (version && version !== source.version)
                        update((s) => ({
                          ...s,
                          legalSources: s.legalSources.map((v) =>
                            v.id === source.id
                              ? {
                                  ...v,
                                  version,
                                  verification: "unverified",
                                  history: [
                                    ...v.history,
                                    `${new Date().toISOString()} · Versione ${version}, da verificare`,
                                  ],
                                }
                              : v,
                          ),
                        }));
                    }}
                  />
                </label>
                <details>
                  <summary>Storico aggiornamenti</summary>
                  <ul>
                    {source.history.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </details>
                <div className="inline-actions">
                  <Button asChild variant="outline">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Consulta originale <ArrowUpRight size={17} />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Elimina fonte ${source.title}`}
                    onClick={() => {
                      if (confirm("Eliminare questa annotazione normativa?"))
                        update((s) => ({
                          ...s,
                          legalSources: s.legalSources.filter(
                            (v) => v.id !== source.id,
                          ),
                        }));
                    }}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </Panel>
            ))}
        </div>
      ) : (
        <Panel>
          <Empty title="Nessuna fonte normativa registrata">
            Aggiungi gli estremi di un atto dopo aver consultato la fonte
            primaria. Non vengono precaricati articoli o stati di vigenza
            presunti.
          </Empty>
        </Panel>
      )}
      <h2>Portali istituzionali per la consultazione</h2>
      <div className="catalog-grid">
        {[
          {
            title: "Normattiva",
            url: "https://www.normattiva.it/",
            text: "Ricerca il testo degli atti e consulta le versioni disponibili.",
          },
          {
            title: "Gazzetta Ufficiale",
            url: "https://www.gazzettaufficiale.it/",
            text: "Consulta gli atti pubblicati e i relativi estremi ufficiali.",
          },
          {
            title: "Ministero dell’istruzione e del merito",
            url: "https://www.mim.gov.it/",
            text: "Consulta comunicazioni istituzionali, provvedimenti e bandi.",
          },
        ].map((s) => (
          <Panel key={s.url}>
            <span className="icon-tile gold">
              <Scale size={24} />
            </span>
            <h2>{s.title}</h2>
            <p>{s.text}</p>
            <p className="source-note">
              Portale ufficiale · nessun atto acquisito o verificato
            </p>
            <Button asChild variant="outline">
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                Apri portale ufficiale <ArrowUpRight size={17} />
              </a>
            </Button>
          </Panel>
        ))}
      </div>
    </>
  );
}
