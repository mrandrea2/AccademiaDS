# Accademia DS — edizione locale senza Supabase

Applicazione web per preparazione al concorso di dirigente scolastico. **Versione funzionante di base, non piattaforma esaustiva**.

## Cosa funziona
- Nove aree tematiche; 36 domande di allenamento originali con fonti indicative e opzioni randomizzate.
- Cronologia e accuratezza dei quiz salvate con IndexedDB.
- Flashcard, casi situazionali con soluzioni locali, editor per prova scritta e appunti.
- Biblioteca locale di testo TXT/MD; note normative con collegamenti ufficiali.
- Backup JSON ed importazione.
- Tutor Claude con API proxy server-side Vercel e password privata.
- UI responsive, senza Supabase né database remoto.

## Limiti dichiarati
- **Non** legge automaticamente PDF/DOCX né sincronizza Google Drive.
- **Non** verifica automaticamente novità normative: la sezione normativa propone fonti ufficiali e un registro di studio.
- Il tutor usa Anthropic senza accesso autonomo al web, potrebbe commettere errori. Non è una fonte giuridica ufficiale.
- L’accesso con password protegge solo la **route AI**, non l’intero sito o i dati locali del browser.
- Nessun sistema centralizzato di rate-limiting: per una pubblicazione pubblica è consigliato un limite di spesa presso Anthropic o un proxy con rate limiting. Usa password forte e ruotala se divulgata.
- La permanenza dei progressi dipende dall’archiviazione del browser: importa/esporta backup frequentemente.
- Il modello Anthropic specificato deve essere compatibile con il tuo account e verificato sulla console ufficiale.

## Avvio locale
Puoi aprire la cartella con un server statico; ad esempio `npx serve . -l 3000` (richiede Node). Per le API Claude usa Vercel (`vercel dev`) e configura `.env.local`. **Non** aprire index.html direttamente tramite file://: i moduli JavaScript richiedono HTTP.

## Deploy a Vercel
1. Crea un repository **privato** preferibilmente, carica tutti i file contenuti nella cartella (index.html alla radice).
2. Importa il repository in Vercel. Framework Preset: **Other**; Build Command: vuoto; Output Directory: vuoto; Root Directory: radice.
3. Settings → Environment Variables: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `APP_PASSWORD`. Nessuna chiave deve avere prefisso `NEXT_PUBLIC_`.
4. Redeploy e verifica che la UI si apra; nella sezione Tutor inserisci `APP_PASSWORD`.
5. Imposta sul tuo account Anthropic budget e alert di spesa. Verifica le condizioni del piano Vercel.

### Nota sul progetto GitHub esistente
Questa è una **app statica indipendente** e non una patch automatica del repository Next.js preesistente. Per non perdere il progetto vecchio usa un nuovo repository o un branch separato, oppure effettua prima un backup del repository e sostituisci il contenuto deliberatamente.

## Privacy e copyright
Non caricare i quattro manuali commerciali o documenti riservati nella cartella pubblica del sito. I documenti TXT importati dalla UI restano in IndexedDB sul dispositivo, ma se li invii al tutor vengono spediti ad Anthropic per elaborazione. Evita informazioni personali identificabili degli studenti.

## Costi
Nessun costo per Supabase. Vercel e Anthropic possono applicare i limiti, costi e termini dei rispettivi piani.
