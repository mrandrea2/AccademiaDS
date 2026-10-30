# Verifiche attuali: acquisizione privata PDF/DOCX

Esecuzione del 30 ottobre 2026, Node.js 24.19.0. Nessuna credenziale Supabase, Google OAuth, AI o OCR configurata nell’istanza di sviluppo; nessun libro reale importato.

| Verifica                  | Esito                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run lint`            | Riuscito, nessun warning                                                                          |
| `npm run typecheck`       | Riuscito, TypeScript strict                                                                       |
| `npm test`                | **49 test passati** in 7 suite                                                                    |
| `npm run build`           | Riuscito, nessun warning del parser PDF                                                           |
| Tracing Vercel            | Worker PDF e font standard presenti nel manifest della funzione process                           |
| E2E sul server production | **17 passati, 1 saltato intenzionalmente** (menu mobile nel progetto desktop)                     |
| axe                       | Nessuna violazione automatica A/AA rilevata sulle 12 schermate in desktop e mobile (24 scansioni) |
| Protezione Git            | PDF/DOCX ignorati; nessun originale privato o valore di credenziale presente nel commit           |

I 49 test comprendono 10 test dei parser PDF/DOCX e della cifratura, 9 di apprendimento/validazione, 7 di OAuth/differenziale/citazioni/limiti di risposta, 7 del database legacy, 11 di schema materiali/pgvector/RLS/storage/revoca consensi/lease/deduplica, 2 del contratto di creazione bozze e 3 del pannello amministrativo.

Sono esercitati parser reali su documenti generati in memoria e PostgreSQL WASM con pgvector. Il contratto minimo Supabase Auth/Storage è simulato nel database locale; OAuth e chiamate token Google usano risposte simulate. I test UI verificano che il binario vada allo Storage e solo i metadati alle API Vercel, e che una bozza non venga pubblicata automaticamente.

Le suite browser verificano i flussi precedenti, la nuova schermata in assenza di credenziali e il rifiuto degli endpoint privati quando non configurati. Il pannello amministrativo autenticato è verificato nei test UI con risposte simulate, non contro un progetto Supabase ospitato. Le scansioni axe non certificano da sole conformità completa WCAG o comportamento con screen reader reali.

## Richiedono ancora verifica nell’ambiente del proprietario

- Upload e policy contro Supabase Storage reale, sessioni/cookie, limiti del piano e configurazione delle migrations 002/003.
- Consenso OAuth reale, accesso ai 38 file indicati, refresh token, sincronizzazione e revoca su Google Drive.
- OCR contro un motore esterno configurato, qualità dei manuali reali e revisione delle trascrizioni.
- Embeddings e sintesi contro un provider AI reale, costi, condizioni di trattamento e adeguatezza delle risposte.
- Esito del nuovo deployment Vercel: build locale e push GitHub non equivalgono a un’osservazione del deployment remoto.

Comando E2E eseguito:

```bash
CI=1 PLAYWRIGHT_USE_PRODUCTION=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Il server dev precedentemente avviato è stato arrestato per assicurare che i test usassero il build production. Nessuna sincronizzazione reale viene dichiarata operativa in assenza di credenziali e consenso.

---

# Verifiche della prima versione (storico)

Esecuzione del 30 ottobre 2026 nell’ambiente cloud, Node.js 24.19.0. Credenziali Supabase, AI e Vercel assenti; nessun file `.env` privato è stato creato.

| Verifica                         | Esito                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm ci --no-audit --no-fund`    | Installazione riproducibile riuscita                                                                           |
| `npm run lint`                   | Nessun errore o warning                                                                                        |
| `npm run typecheck`              | TypeScript strict riuscito                                                                                     |
| `npm test`                       | 16 test passati: 9 di apprendimento/validazione e 7 PostgreSQL/RLS                                             |
| `npm run build`                  | Build Next.js production riuscita, home prerenderizzata e quattro endpoint dinamici                            |
| Playwright sul server production | 15 test passati, 1 intenzionalmente saltato: verifica menu mobile non pertinente al progetto desktop           |
| axe WCAG A/AA e 2.1 AA           | Nessuna violazione rilevata sulle 11 schermate in entrambe le viewport (22 scansioni)                          |
| Layout                           | Nessuno scorrimento orizzontale nelle viewport desktop e mobile testate; schermate ispezionate visivamente     |
| `git diff --check`               | Nessun problema di whitespace rilevato; repository inizialmente senza commit, nuovi file non ancora pubblicati |

Comando E2E usato:

```bash
PLAYWRIGHT_USE_PRODUCTION=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Il download del Chromium Playwright era vietato dalla policy del dominio; è stato usato Chromium 154 di sistema senza disattivare TLS o verifiche degli artefatti. I primi problemi di contrasto, selettori dei test e indicazione del salvataggio sono stati corretti e le verifiche interessate rieseguite.

## Cosa attestano i test

- Completamento e persistenza di lezioni e risposte; risposta corretta riconosciuta tramite ID dopo shuffle.
- Bozza scritta persistente; SM-2 e programmazione del ripasso.
- Importazione di un documento testuale, ricerca locale con citazione a pagina/versione, esportazione ed eliminazione.
- Simulazione configurabile: scadenza con clock avanzato, omissioni conteggiate separatamente e punteggio personale.
- Registro normativo: stato personale, storico e persistenza dopo ricarica.
- Menu mobile: chiusura con Esc e restituzione del focus.
- Endpoint privati senza configurazione: risposta 503, senza falsa attestazione di accesso remoto.
- PostgreSQL reale WASM: migration applicata integralmente, 15 tabelle pubbliche con RLS, visibilità separata per due utenti, rifiuto di ownership spoofing e FK trasversali, salvataggio atomico, conflitto di revisione, ricerca per pagina, cancellazione e cascata account.

## Non verificato in questa istanza

Auth, refresh dei cookie, SMTP e RPC contro un progetto Supabase ospitato; sintesi contro il provider AI; registrazione con dispositivi audio fisici; Safari/Firefox reali; verifica manuale con screen reader; pubblicazione GitHub/Vercel e ripristino dell’ambiente in un nuovo task. L’isolamento RLS è testato sul motore PostgreSQL locale, non su un progetto remoto. I test axe automatici non certificano da soli la conformità completa WCAG.

`install_script` e `start_skill` sono salvati nella bozza dell’ambiente cloud. Il salvataggio non pubblica la configurazione né effettua il deployment Vercel: per lo snapshot dell’ambiente occorre rivedere e salvare le impostazioni, quindi pubblicare tramite il prodotto.
