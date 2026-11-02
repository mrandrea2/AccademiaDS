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

## Versione 1.1 — percorso guidato e PDF

- **Oggi: il tuo piano**: sequenza suggerita di recupero attivo, studio essenziale e quiz; scelta 20–90 minuti al giorno. I progressi sono salvati localmente.
- **Studio guidato**: nove lezioni introduttive originali, ciascuna con testo, tre obiettivi di padronanza e recupero attivo. Non rappresentano un corso completo o una sintesi verificata dei 42 documenti dell'utente.
- **Flashcard**: prima pianificazione di richiami a 1, 3, 7, 14, 30 e 60 giorni sulla base della valutazione soggettiva. È un'euristica didattica, non un sistema FSRS validato o una misura scientifica personalizzata della memoria.
- **Biblioteca PDF**: usa PDF.js via CDN dal browser per estrarre il testo dei PDF digitali. Richiede connessione al primo utilizzo e non supporta OCR. I PDF con sole immagini richiedono un passaggio OCR esterno. Per contenere la quota IndexedDB memorizza al massimo 500 mila caratteri per documento, segnalandone il troncamento.
- **Appunti Claude**: il pulsante invia soltanto il primo estratto fino a 14.000 caratteri ad Anthropic tramite `/api/chat`; genera una sintesi parziale che non può essere descritta come riassunto completo dell'intero manuale. Richiede `APP_PASSWORD` e `ANTHROPIC_API_KEY` su Vercel. Può generare costi. Verificare citazioni e normativa.
- Importando un libro non vengono generati automaticamente tutti i capitoli. La conversione completa in un curriculum personalizzato e la verifica normativa automatica restano evoluzioni da sviluppare.
- **Sicurezza**: il materiale inserito in IndexedDB è disponibile agli utenti del browser locale e non è cifrato. Non usare computer condivisi per documenti sensibili. L'endpoint AI è protetto da password ma non include rate limiting robusto; prima di un'esposizione pubblica aggiungere limiti server-side o protezione della distribuzione.
