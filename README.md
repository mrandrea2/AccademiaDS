# DS Academy

Piattaforma italiana di studio personale per la preparazione alla dirigenza scolastica. Next.js App Router, TypeScript strict, Tailwind 4, componenti shadcn/ui (Button/Radix), Lucide, Supabase Auth/Postgres, Zod, Vitest e Playwright. Compatibile con Vercel, senza servizi Node persistenti richiesti.

**Contenuti inclusi: esclusivamente dimostrativi e non verificati.** Nessuna banca dati ufficiale, normativa validata, punteggio d’esame o data di concorso inventati. Le nove aree sono una tassonomia di studio da confrontare con il bando effettivamente applicabile. Il repository era vuoto all’inizio del lavoro: `PreparazioneDS2027.jsx` non è stato trovato localmente né sul remoto. Non è stata dichiarata una migrazione di contenuti mai esaminati.

## Acquisizione privata PDF/DOCX e Google Drive

La nuova area **Materiali privati** consente upload diretto a Supabase Storage, estrazione a lotti, revisione OCR, SHA-256, versioni, classificazione modificabile, indice full-text/pgvector e bozze didattiche con approvazione. Le fonti restano private e non verificate: nessun libro o token è nel repository. Google Drive è predisposto con OAuth indipendente, **non attivo senza credenziali e autorizzazione**. Non è stato dichiarato l’accesso ai 38 file della cartella indicata.

Per attivare l’upload applica le migrations **002 e 003** dopo la 001 già presente e abilita il tuo account amministratore via SQL. Le chiavi Google e AI non servono per il caricamento manuale e la ricerca full-text.

- [Configurazione storage e utilizzo della pipeline](docs/materials-setup.md)
- [Google OAuth e sincronizzazione differenziale](docs/google-drive-oauth.md)
- [Sicurezza, licenze e isolamento dei materiali](docs/materials-security.md)

## Avvio rapido

Richiede Node.js 22.9+ (testato su Node 24), npm e Git.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Senza variabili Supabase l’applicazione funziona in **demo locale**, dichiarata in ogni schermata. Documenti, progressi, bozze e impostazioni sono salvati nel localStorage di questo browser. Nessun dato fittizio viene presentato come attività dell’utente. Usa Impostazioni → Esporta archivio prima di cancellare i dati del browser. Non usare un browser condiviso per appunti riservati. Audio temporaneo in memoria, da scaricare prima di cambiare pagina. Nessuna telemetria applicativa è stata aggiunta.

## Funzioni operative

| Modulo        | Comportamento implementato                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard     | KPI dai dati reali dell’archivio, progresso lezioni, minuti registrati, obiettivo settimanale, prossima lezione e attività                                                                  |
| Biblioteca    | Inserimento testo o file UTF-8 `.txt`, tag, ricerca, filtro, lettura per pagina, eliminazione e metadati di provenienza/versione                                                            |
| Percorsi      | Nove aree con una scheda di metodo ciascuna, glossario, esempio, approfondimento guidato e completamento persistente                                                                        |
| Quiz          | Nove esercizi di metodo dimostrativi, filtri per area/difficoltà, Fisher–Yates sulle domande e opzioni, risposta corretta per ID, spiegazioni, cronologia e ripasso degli ultimi errori     |
| Simulazione   | Numero, durata e punti corretta/errata/omessa configurabili, timer, omissioni e risultato; usa soltanto i quesiti disponibili e dichiara il campione                                        |
| Flashcard     | SM-2 con valutazione, intervalli, soglia minima dell’ease, selezione delle carte in scadenza e ripasso anticipato                                                                           |
| Prova scritta | Bozza con autosalvataggio, due casi inventati, timer con pausa, quattro mosse, autovalutazione e feedback strutturale deterministico                                                        |
| Prova orale   | Due casi, cinque passi, note persistenti, griglia personale, registrazione previa richiesta del microfono, ascolto/download/eliminazione audio                                              |
| Tutor         | Ricerca locale con estratti in demo; ricerca full-text Postgres privata da autenticato; sintesi AI opzionale server con riferimenti a estratto/pagina/versione e dichiarazione d’incertezza |
| Normativa     | Registro personale di atti con URL HTTPS, articolo, data dichiarata, versione, stato di verifica personale, storico delle modifiche e portali istituzionali                                 |
| Statistiche   | Accuratezza per area, tempo medio, trend UTC a sette giorni, scadenze SM-2, suggerimento basato sull’area meno accurata                                                                     |
| Impostazioni  | Obiettivo, esportazione/ripristino JSON validato, cancellazione archivio; login/registrazione/logout e cancellazione account quando Supabase è configurato                                  |

**Limiti espliciti:** nessun motore OCR incluso in Vercel (adapter esterno opzionale e trascrizione manuale disponibili), trascrizione audio automatica, corpus normativo curato, valutazione giuridica automatica o calendario del concorso. Il feedback scritto è strutturale, non un voto né una verifica delle citazioni. Le citazioni del tutor sono estratti rintracciabili, non garanzia della loro verità. L’AI può sbagliare anche quando cita un estratto esistente. Nessun processo di revisione editoriale delle fonti viene simulato.

## Supabase

1. Crea un progetto Supabase oppure usa il tuo stack locale.
2. Applica `supabase/migrations/202610300001_academy.sql` con SQL editor o `supabase db push` dopo aver collegato il progetto. La migration è transazionale, si applica una sola volta.
3. Imposta in `.env.local` (e su Vercel) `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. La chiave pubblicabile è progettata per il browser: **non usare una service-role key**.
4. In Auth configura Site URL e redirect ammessi per il dominio di sviluppo/produzione. Attiva conferma email e una password policy adeguata (l’interfaccia richiede 12 caratteri). Personalizza SMTP e limiti di invio prima dell’uso pubblico.
5. Per conferma email SSR, imposta il link del template Supabase su `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. L’endpoint verifica l’OTP prima di creare i cookie. Non accetta redirect arbitrari.
6. Riavvia Next dopo ogni modifica delle variabili pubbliche. Crea un account e verifica il flusso su un ambiente Supabase di staging.

I dati demo non vengono copiati implicitamente all’accesso. Esportali e ripristinali deliberatamente nell’account se lo desideri. Se il caricamento remoto fallisce l’app blocca l’editor: non sostituisce i dati remoti con uno stato vuoto. I conflitti di revisione bloccano le scritture fino al ricaricamento; esporta prima le modifiche ancora in memoria.

### Tutor remoto opzionale

`AI_API_KEY` è solo server; `AI_MODEL` seleziona il modello (default `gpt-4.1-mini`). La richiesta usa l’endpoint HTTPS OpenAI Chat Completions. In assenza di chiave l’app restituisce gli estratti senza fingere una sintesi AI. In assenza di risultati non chiama il modello. Le citazioni sono validate rispetto agli estratti effettivamente recuperati, altrimenti la risposta viene rifiutata. Non è una difesa assoluta contro allucinazioni o prompt injection.

Consenti `api.openai.com` nella rete dell’ambiente se attivi questa integrazione. La chiave non viene salvata nel client né nei documenti. Nella pipeline PDF/DOCX il consenso esterno è separato per documento; ricerca semantica e sintesi del tutor sono opzioni esplicite. Sono trasmessi domanda e massimo quattro estratti privati: configura il provider e informa chi usa l’istanza sulle condizioni di trattamento dati. Prima di un servizio pubblico a pagamento aggiungi quote per account e rate limiting distribuito secondo il budget: non è incluso un sistema di billing o di controllo dei costi multi-tenant.

## Verifiche

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Se Chromium è già installato, puoi evitare il download:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Vitest esercita SM-2, shuffle, metriche, retrieval, validazione degli import, parser PDF/DOCX, pannello upload, OAuth simulato e tutte le migrations su PostgreSQL WASM/PGlite con pgvector e contratto Auth/Storage Supabase minimo. Testa RLS tra due utenti, FK composite, revisione ottimistica, indicizzazione per pagina e cancellazione account. Non sostituisce un test con le credenziali del tuo Supabase reale. Playwright copre desktop/mobile, persistenza, quiz, biblioteca, tutor, bozza scritta, flashcard, registro normativo e controlli automatici axe. La CI usa il Chromium ufficiale Playwright.

## Struttura

```text
app/                    App Router, layout, loading/error, API e conferma Auth
components/academy.tsx  shell accessibile, sidebar e navigazione
components/modules/     undici moduli separati
components/ui/          componenti shadcn/ui locali
lib/                    modelli, schema Zod, contenuti demo, SM-2 e persistenza
supabase/migrations/    schema, indici, vincoli, RLS, RPC
supabase/seed.sql       policy esplicita: nessun dato condiviso o PDF
 tests/                 unità, PostgreSQL/RLS ed E2E
 docs/                  architettura e deployment
```

Vedi [architettura](docs/architecture.md), [piano di migrazione](docs/migration.md), [deployment](docs/deployment.md) e [verifiche eseguite](docs/validation.md).
