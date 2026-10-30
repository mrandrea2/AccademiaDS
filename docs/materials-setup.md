# Materiali privati: installazione e utilizzo

La pipeline è indipendente dal vecchio archivio JSON della demo. Nessun file della cartella Drive è incluso nel repository. I 38 file segnalati e gli altri quattro manuali non sono stati importati in questa istanza: servono i file oppure l’autorizzazione Google dell’app distribuita.

## Prima attivazione in Supabase

1. Mantieni la migration `202610300001_academy.sql` già applicata. **Non rieseguirla.**
2. Esegui, una sola volta e nell’ordine, in SQL Editor:
   - `202610300002_materials.sql`: archivio, versioni, ruoli, pgvector, ricerca, bozze e OAuth cifrato;
   - `202610300003_material_storage.sql`: bucket privato e policy degli originali.
3. Registrati nell’app, conferma l’email ed effettua l’accesso.
4. Da SQL Editor abilita **solo il tuo account** come amministratore, sostituendo l’email seguente:

```sql
insert into public.material_admins(user_id)
select id from auth.users where email = 'LA-TUA-EMAIL'
on conflict do nothing;
```

Controlla che la query abbia inserito una riga. Il client non può assegnarsi il ruolo modificando il proprio profilo. Gli amministratori gestiscono soltanto i materiali di loro proprietà: non possono leggere quelli di altri amministratori.

5. In Storage verifica che `academy-materials` sia **Private**, limite 50 MiB e MIME consentiti soltanto PDF/DOCX. Non convertirlo in Public e non creare policy generiche come `true`.
6. Su Vercel bastano le variabili Supabase pubblicabili già descritte nel README. Esegui il deployment del nuovo commit. Non servono Google, chiavi AI o service-role per il caricamento manuale.
7. Apri **Materiali privati**, conferma i diritti d’uso, carica i file e premi **Estrai / riprendi a lotti**. Il browser carica direttamente nello storage privato: non invia il libro come body di una funzione Vercel.

La migration installa `vector` nello schema `extensions`. Se il tuo progetto ha già pgvector in uno schema differente, verifica l’installazione prima di applicare la migration: non spostare estensioni di altri servizi senza valutare le dipendenze. Questa pipeline usa esplicitamente `extensions.vector`.

## Estrazione e revisione

PDF: pagine fisiche, ordine di lettura stimato dalla posizione dei frammenti. Le colonne e tabelle complesse richiedono revisione. Numeri di pagina del file, non necessariamente quelli stampati nel manuale. PDF cifrati, corrotti o eccessivamente complessi producono uno stato d’errore, senza un indice fittizio.

DOCX: paragrafi, titoli di sezione, righe/celle delle tabelle in testo e metadati core. Nessun numero di pagina viene inventato: la paginazione di Word dipende dal layout e dall’ambiente. Non vengono eseguiti macro, JavaScript, JSX, link o immagini incorporati. I file JSX nella cartella Drive sono segnalati come non supportati e non importati come codice applicativo.

Le pagine con meno di 25 caratteri non bianchi sono **candidate** a scansione, pagina vuota o estrazione incompleta; non vengono automaticamente certificate come scansioni. Revisiona la trascrizione e conferma anche eventuali pagine intenzionalmente bianche. L’OCR automatico non basta a sbloccare la pubblicazione: ogni segmento OCR deve essere confermato manualmente.

Dopo la revisione, **Approva estrazione e indicizza** crea l’indice full-text. Questo passaggio certifica solo la revisione della trascrizione, non la correttezza o la vigenza delle fonti, che restano non verificate.

L’area è suggerita da regole lessicali visibili in `lib/ingestion/extract.ts` e modificabile nel pannello. Non è un’affermazione che i materiali corrispondano al programma del bando applicabile.

## Limiti e ripresa

- PDF/DOCX fino a 50 MiB ciascuno; il limite globale Storage del tuo piano Supabase può essere inferiore.
- Fino a 10 file per selezione del browser, 1.500 pagine PDF, DOCX fino a 30 MiB espansi e XML singolo 15 MiB.
- Fino a 8 milioni di caratteri estratti per versione e 12.000 chunk; per volumi superiori suddividi i file prima del caricamento.
- Estrazione PDF in lotti di dieci pagine. Ogni richiesta rilegge l’originale privato: per corpus estesi controlla costi di egress e tempo delle funzioni. OCR esterno in lotti di massimo cinque pagine; embeddings in lotti di 24 chunk.
- Il lavoro è salvato nel database a ogni lotto. Chiudere la pagina interrompe le richieste, non cancella i lotti già completati. Nessun cron o processo in memoria viene presentato come worker persistente.
- Un lease impedisce due estrazioni contemporanee della stessa versione e scade dopo 120 secondi. Dopo un’interruzione attendi la scadenza e riprendi. Gli errori sono registrati, il testo parziale non entra nel tutor.
- Gli aggiornamenti mantengono le versioni precedenti. Il tutor cerca l’ultima versione **indicizzata**, così una nuova estrazione incompleta non distrugge l’indice valido precedente.
- Deduplica SHA-256 per proprietario, calcolata dal server sui byte effettivi. La copia ridondante viene rimossa; il record conserva il riferimento alla versione canonica. Un documento identico di un altro utente non rivela la sua esistenza.
- Per eliminare, usa **Elimina versione privata**: originale, segmenti, chunk e bozze dipendenti vengono rimossi. Se fallisce la rimozione dallo storage il record non viene cancellato silenziosamente.

## Ricerca semantica e RAG

La ricerca full-text è disponibile senza servizi AI. Per embeddings configura `AI_API_KEY` server su Vercel e abilita il consenso esterno del singolo documento. Il pulsante **Indicizza semanticamente / riprendi** usa `text-embedding-3-small`, 1.536 dimensioni; il modello è fissato perché una dimensione diversa richiede una migrazione. I vettori sono salvati in pgvector e cercati per distanza coseno, combinata con il ranking lessicale. La ricerca esatta evita perdite di richiamo degli indici ANN su questo corpus personale limitato.

Nel tutor puoi filtrare le fonti e scegliere separatamente ricerca semantica e sintesi AI. La domanda viene inviata al provider solo se scegli la ricerca semantica e il provider è configurato. La sintesi riceve al massimo quattro estratti di 600 caratteri ciascuno; non viene eseguita se una delle fonti importate non ha consenso esterno. Il server controlla che ogni citazione sia letteralmente presente nell’estratto recuperato. Nessun riscontro significa astensione, non una risposta normativa inventata. Un riferimento esatto non prova che una conclusione sia vera: serve revisione umana.

## Bozze e approvazione didattica

Da una versione indicizzata seleziona un segmento e crea una bozza manuale di quiz, flashcard, sintesi o caso. Il modulo JSON rende modificabili tutti i campi; le strutture sono validate con Zod. Le citazioni sono controllate sul testo del segmento. La generazione AI è facoltativa, richiede chiave e consenso del documento e conserva sempre provenienza `ai` e stato `draft`.

Aggiungi una nota di revisione e approva esplicitamente. Solo dopo il contenuto appare nei tuoi quiz/flashcard/percorsi/casi; non viene pubblicato verso altri utenti o sul web. La modifica di un contenuto approvato lo riporta in bozza. Respingere una bozza approvata la ritira dalla prossima apertura del modulo. Non è previsto un workflow a quattro occhi: il proprietario amministratore è anche il revisore della sua preparazione personale.

## OCR opzionale

Di base puoi trascrivere e correggere manualmente. Per usare un motore OCR separato imposta `OCR_SERVICE_URL` (HTTPS) e `OCR_SERVICE_KEY` esclusivamente sul server. **Non è incluso un motore OCR in Vercel**: l’adapter richiede un tuo servizio autorizzato, per esempio un worker Tesseract gestito da te, conforme al contratto seguente.

Richiesta `POST` multipart con header `Authorization: Bearer <chiave>`:

- `file`: originale PDF privato;
- `pages`: JSON con massimo cinque numeri di pagina fisica, ad esempio `[2,3]`.

Risposta `application/json`:

```json
{
  "pages": [
    { "page": 2, "text": "Trascrizione della pagina…" },
    { "page": 3, "text": "Altra trascrizione…" }
  ]
}
```

Rispondi soltanto per le pagine richieste, senza duplicati, massimo 100.000 caratteri per pagina, entro 45 secondi. L’app rifiuta pagine mancanti/inaspettate. Il motore deve rasterizzare in sandbox, non seguire link o lanciare contenuti del PDF. Il libro completo è inviato al servizio OCR: per questo serve consenso esterno esplicito e un fornitore/worker coerente con le licenze. Non inserire endpoint arbitrari inviati dal browser.

## Dopo il deployment

In staging verifica con due account distinti: nessun accesso trasversale, file privati, upload reale, ripresa estrazione, revisione, ricerca con filtri, approvazione/ritiro delle bozze ed eliminazione di una versione. I test locali PostgreSQL e quelli con risposte Google simulate non sostituiscono questi controlli sul tuo progetto reale.
