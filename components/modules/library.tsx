"use client";
import type { DocumentRecord, StudyState } from "@/lib/models";
import { documentSchema } from "@/lib/validation";
import { Library, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import { Badge, Empty, Panel, type Update } from "@/components/shared";
export function LibraryModule({
  state,
  update,
  search,
  setSearch,
}: {
  state: StudyState;
  update: Update;
  search: string;
  setSearch: (s: string) => void;
}) {
  const [tag, setTag] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [message, setMessage] = useState("");
  const filtered = state.documents.filter(
    (d) =>
      `${d.title} ${d.text} ${d.tags.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!tag || d.tags.includes(tag)),
  );
  return (
    <>
      <div className="toolbar">
        <label className="search-field">
          <Search size={19} />
          <input
            aria-label="Cerca nella biblioteca"
            placeholder="Cerca titolo, contenuto o tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtra per tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        >
          <option value="">Tutti i tag</option>
          {[...new Set(state.documents.flatMap((d) => d.tags))].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Button onClick={() => setAdding(!adding)}>
          <Plus size={18} />
          {adding ? "Chiudi modulo" : "Aggiungi documento"}
        </Button>
      </div>
      <p>
        <a className="text-link" href="?section=materiali">
          Importa PDF/DOCX nell’area Materiali privati →
        </a>
      </p>
      <p className="notice">
        Importa testo semplice (.txt) o incolla un estratto di cui hai diritto
        d’uso. Per PDF e DOCX usa l’area amministrativa Materiali privati.
        Separa le pagine con un carattere di avanzamento pagina (form feed) per
        mantenere i riferimenti.
      </p>
      {adding && (
        <Panel>
          <h2>Nuovo documento privato</h2>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              const parsed = documentSchema.safeParse({
                id: crypto.randomUUID(),
                title: f.get("title"),
                text: f.get("text"),
                tags: String(f.get("tags"))
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                createdAt: new Date().toISOString(),
                source: {
                  version: f.get("version"),
                  provenance: f.get("provenance"),
                  verification: "unverified",
                },
              });
              if (!parsed.success) {
                setMessage(parsed.error.issues[0].message);
                return;
              }
              update((s) => ({
                ...s,
                documents: [parsed.data, ...s.documents],
              }));
              setMessage("Documento aggiunto. Fonte non verificata.");
              setAdding(false);
              form.reset();
            }}
          >
            <label>
              Titolo
              <input name="title" required minLength={3} maxLength={180} />
            </label>
            <div className="form-grid">
              <label>
                Tag separati da virgola
                <input name="tags" maxLength={400} />
              </label>
              <label>
                Versione
                <input
                  name="version"
                  defaultValue="1"
                  required
                  maxLength={80}
                />
              </label>
              <label>
                Provenienza
                <select name="provenance">
                  <option value="personal">Appunti personali</option>
                  <option value="manual">Estratto da manuale</option>
                  <option value="official">
                    Trascrizione di fonte ufficiale, da verificare
                  </option>
                  <option value="ai">Testo generato da AI</option>
                </select>
              </label>
            </div>
            <label>
              Importa testo UTF-8
              <input
                type="file"
                accept=".txt,text/plain"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 600000) {
                      setMessage("File troppo grande (massimo 600 KB).");
                      return;
                    }
                    const text = await f.text();
                    const field =
                      document.querySelector<HTMLTextAreaElement>(
                        "#document-text",
                      );
                    if (field) field.value = text;
                  }
                }}
              />
            </label>
            <label>
              Contenuto
              <textarea
                id="document-text"
                name="text"
                rows={8}
                minLength={30}
                maxLength={150000}
                required
              />
            </label>
            <Button type="submit">Salva documento</Button>
          </form>
        </Panel>
      )}
      <p role="status">{message}</p>
      {!filtered.length ? (
        <Panel>
          <Empty
            title={
              state.documents.length
                ? "Nessun risultato"
                : "La tua biblioteca prende forma da qui"
            }
          >
            Aggiungi un documento privato per cercarlo, leggerlo e utilizzarlo
            nel tutor.
          </Empty>
        </Panel>
      ) : (
        <div className="catalog-grid">
          {filtered.map((d) => (
            <Panel key={d.id}>
              <span className="icon-tile blue">
                <Library size={24} />
              </span>
              <h2>{d.title}</h2>
              <div className="tags">
                {d.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
              <p className="muted">
                {d.source.provenance} · versione {d.source.version} · non
                verificato
              </p>
              <p>
                {new Date(d.createdAt).toLocaleDateString("it-IT")} ·{" "}
                {d.text.split("\f").length} pagine di testo
              </p>
              <div className="inline-actions">
                <Button variant="outline" onClick={() => setSelected(d)}>
                  Leggi documento
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Elimina ${d.title}`}
                  onClick={() => {
                    if (
                      confirm(
                        `Eliminare «${d.title}» e i suoi estratti dall’archivio?`,
                      )
                    ) {
                      update((s) => ({
                        ...s,
                        documents: s.documents.filter((x) => x.id !== d.id),
                      }));
                      setSelected(null);
                    }
                  }}
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
      {selected && (
        <Panel>
          <div className="section-header">
            <h2>{selected.title}</h2>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Chiudi lettura
            </Button>
          </div>
          {selected.text.split("\f").map((page, i) => (
            <article key={i} className="document-page">
              <Badge>
                Pagina {i + 1} · versione {selected.source.version}
              </Badge>
              <p className="preserve">{page}</p>
            </article>
          ))}
        </Panel>
      )}
    </>
  );
}
