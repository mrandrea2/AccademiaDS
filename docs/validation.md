# Verifiche eseguite

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
