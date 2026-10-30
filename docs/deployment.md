# GitHub e Vercel

## GitHub

Il progetto include lockfile e workflow CI. Prima di pubblicare verificare `git diff --check`, che `.env.local` sia ignorato e che non ci siano documenti riservati. Non caricare PDF o segreti in `public/` (qui non è presente una raccolta pubblica di documenti).

```bash
git add .
git commit -m "Build DS Academy study platform"
git push -u origin HEAD
```

Se vuoi usare `main`, crea o scegli quella branch secondo il workflow del repository. Non fare force-push e non sovrascrivere codice remoto aggiunto da altri.

## Vercel

1. Importa il repository GitHub in Vercel, framework Next.js, root directory del progetto, Node.js 24.
2. Comandi: `npm ci`, `npm run build`; lascia a Vercel la gestione dell’output Next.js.
3. Per demo non servono variabili; il banner dichiara sempre il salvataggio locale.
4. Per account e cloud: crea Supabase, applica la migration, configura Auth URL/SMTP e variabili pubblicabili come nel README. Non esporre mai `AI_API_KEY` con un prefisso `NEXT_PUBLIC_`.
5. Per AI opzionale imposta `AI_API_KEY` e `AI_MODEL` in ambiente server. Timeout della chiamata 30 secondi: scegli un piano e una durata funzione compatibili. Valuta costi, conservazione dati del provider e quote prima di aprire il servizio a terzi.
6. Avvia un deployment Preview, poi verifica registrazione/conferma email/login, salvataggio con ricarica e due utenti distinti, retrieval e cancellazione account. Infine promuovi in produzione.

Nessun dominio Vercel, progetto Supabase reale o invio email sono implicitamente creati dalla build. Una build locale riuscita non attesta un deployment remoto. I test PostgreSQL locali simulano solo lo schema Auth minimo, non SMTP, refresh cookie o API Supabase ospitate.
