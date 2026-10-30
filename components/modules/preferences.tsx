"use client";
import { emptyState } from "@/lib/content";
import type { StudyState } from "@/lib/models";
import { browserSupabase, hasSupabase } from "@/lib/supabase";
import { stateSchema } from "@/lib/validation";
import { CircleHelp, Download, LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import { Badge, Panel, exportJson, type Update } from "@/components/shared";
export function Preferences({
  state,
  update,
  connected,
}: {
  state: StudyState;
  update: Update;
  connected: boolean;
}) {
  const [message, setMessage] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [busy, setBusy] = useState(false);
  return (
    <div className="editor-grid">
      <div className="stack">
        <Panel>
          <h2>Il tuo ritmo di studio</h2>
          <label>
            Obiettivo settimanale in minuti
            <input
              type="number"
              min={15}
              max={2400}
              step={15}
              value={state.goal.weeklyMinutes}
              onChange={(e) => {
                const value = e.target.valueAsNumber;
                if (Number.isInteger(value) && value >= 15 && value <= 2400)
                  update((s) => ({ ...s, goal: { weeklyMinutes: value } }));
              }}
            />
          </label>
          <p>
            Tempo effettivamente registrato dalle sessioni di studio. Modifica
            l’obiettivo quando vuoi.
          </p>
        </Panel>
        <Panel>
          <h2>I tuoi dati, sotto il tuo controllo</h2>
          <p>
            I materiali PDF/DOCX amministrativi sono separati da questo archivio
            di progressi: eliminali da Materiali privati. L’eliminazione
            dell’account rimuove anche gli originali privati.
          </p>
          <p>
            {connected
              ? "Il tuo archivio viene sincronizzato con l’account Supabase. I documenti sono privati e soggetti a RLS."
              : "In modalità demo i dati sono nel localStorage del browser, senza account. Chi accede a questo profilo del browser può leggerli."}
          </p>
          <p>
            Le registrazioni audio restano in memoria e non vengono caricate. Il
            tutor invia estratti al provider AI solo se configurato sul server e
            solo dopo una tua domanda.
          </p>
          <div className="inline-actions">
            <Button variant="outline" onClick={() => exportJson(state)}>
              <Download size={17} />
              Esporta archivio
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (
                  confirm(
                    "Cancellare documenti, bozze e progressi da questo archivio? L’operazione non è annullabile.",
                  )
                ) {
                  update(() => emptyState());
                  setMessage(
                    "Archivio svuotato. Attendi la conferma di salvataggio prima di chiudere.",
                  );
                }
              }}
            >
              <Trash2 size={17} />
              Cancella dati di studio
            </Button>
          </div>
          <label className="import-label">
            Ripristina un’esportazione JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2500000) {
                  setMessage("Esportazione troppo grande (massimo 2,5 MB).");
                  return;
                }
                try {
                  const parsed = JSON.parse(await file.text());
                  const next = stateSchema.parse(parsed.state);
                  if (
                    confirm(
                      "Sostituire l’archivio corrente con i dati importati?",
                    )
                  ) {
                    update(() => next);
                    setMessage(
                      "Importazione completata. Attendi il salvataggio.",
                    );
                  }
                } catch {
                  setMessage("File non valido: archivio originale conservato.");
                }
                e.target.value = "";
              }}
            />
          </label>
        </Panel>
      </div>
      <div className="stack">
        <Panel>
          <h2>
            {connected ? "Account connesso" : "Accedi al tuo archivio privato"}
          </h2>
          {!hasSupabase ? (
            <>
              <Badge>Demo locale</Badge>
              <p>
                Supabase non configurato. Per attivare l’account, imposta URL e
                chiave pubblicabile sul server di sviluppo o su Vercel e applica
                le migrations. Non inserire credenziali in questa pagina.
              </p>
            </>
          ) : connected ? (
            <>
              <p>
                La demo locale e l’archivio remoto restano separati. Usa
                esportazione e ripristino per trasferire consapevolmente i dati.
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  const db = browserSupabase();
                  const { error } = await db!.auth.signOut();
                  if (error) setMessage("Uscita non riuscita. Riprova.");
                  else location.reload();
                }}
              >
                <LogOut size={17} />
                Esci
              </Button>
              <h3>Cancellazione account</h3>
              <p>
                Elimina account e dati associati. Conserva prima un’esportazione
                se necessaria.
              </p>
              <Button
                variant="destructive"
                onClick={async () => {
                  const confirmText = prompt(
                    "Per eliminare definitivamente account e dati, scrivi ELIMINA ACCOUNT",
                  );
                  if (confirmText !== "ELIMINA ACCOUNT") return;
                  setBusy(true);
                  try {
                    const response = await fetch("/api/account", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ confirm: confirmText }),
                    });
                    if (!response.ok) throw new Error();
                    location.reload();
                  } catch {
                    setMessage("Cancellazione account non riuscita.");
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                Elimina account definitivamente
              </Button>
            </>
          ) : (
            <>
              <div className="inline-actions">
                <Button
                  variant={authMode === "login" ? "default" : "outline"}
                  onClick={() => setAuthMode("login")}
                >
                  Accedi
                </Button>
                <Button
                  variant={authMode === "signup" ? "default" : "outline"}
                  onClick={() => setAuthMode("signup")}
                >
                  Registrati
                </Button>
              </div>
              <form
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const form = new FormData(e.currentTarget);
                  const credentials = {
                    email: String(form.get("email")),
                    password: String(form.get("password")),
                  };
                  try {
                    const db = browserSupabase()!;
                    const { data, error } =
                      authMode === "login"
                        ? await db.auth.signInWithPassword(credentials)
                        : await db.auth.signUp(credentials);
                    if (error) throw error;
                    setMessage(
                      data.session
                        ? "Accesso riuscito. Caricamento archivio…"
                        : "Controlla l’email per confermare l’account.",
                    );
                  } catch {
                    setMessage(
                      "Accesso non riuscito. Controlla credenziali, conferma email e configurazione Supabase.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  Password (almeno 12 caratteri)
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    autoComplete={
                      authMode === "login" ? "current-password" : "new-password"
                    }
                    required
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  {busy
                    ? "Attendi…"
                    : authMode === "login"
                      ? "Entra"
                      : "Crea account"}
                </Button>
              </form>
            </>
          )}
        </Panel>
        <Panel>
          <CircleHelp size={23} />
          <h2>Contenuti e responsabilità</h2>
          <p>
            DS Academy è uno strumento di studio personale, non un servizio
            istituzionale. Schede, quiz e casi inclusi sono dimostrativi, senza
            valore normativo o ufficiale. Verifica sempre il bando e le fonti
            primarie applicabili.
          </p>
        </Panel>
      </div>
      <p className="message" role="status">
        {message}
      </p>
    </div>
  );
}
