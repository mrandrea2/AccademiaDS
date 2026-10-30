# Sicurezza e modello dati dell’acquisizione

## Confini

- Il client possiede soltanto la chiave Supabase pubblicabile e la propria sessione Auth.
- Gli endpoint materiali richiedono `getUser()` e `is_material_admin()`. RLS replica il controllo sul database: autenticazione e amministrazione da sole non consentono letture di altri proprietari.
- `material_admins` può essere popolata solo dall’operatore nel database. Nessun `role` modificabile in `profiles`, metadata client o email inviata dal browser abilita l’amministrazione.
- `materials`, `material_versions`, `material_segments`, `material_chunks`, `ingestion_events`, `teaching_drafts`, `drive_items` e `drive_sync_runs` hanno RLS, proprietario e FK composite. Tutte le versioni sono separate dal vecchio snapshot JSON, che non le cancella né reindicizza.
- Gli originali stanno soltanto nel bucket privato `academy-materials`. Il path è vincolato a `<auth.uid>/<version UUID>/original`. Insert consentito solo per un job prenotato di quel proprietario. Nessuna policy pubblica, nessun endpoint di download Vercel, nessuna URL firmata esposta al client per leggere gli originali.
- Il proprietario autorizzato conserva tecnicamente i privilegi di lettura dei propri oggetti via Storage API: privatezza non significa DRM o impossibilità di copiare il proprio contenuto. Non è implementata una protezione anticopia contro il proprietario.

## File non affidabili

Estensione e MIME dichiarati non bastano: il server verifica magic bytes, dimensione reale e parsing. Il DOCX è trattato come archivio ZIP/XML, con limiti di espansione, senza scrivere path su filesystem o seguire entità esterne. I PDF vengono letti tramite PDF.js lato Node per il testo; non si eseguono script incorporati o font nel browser dell’utente. Il testo viene visualizzato come testo React, senza `dangerouslySetInnerHTML`.

I parser di formati complessi restano una superficie d’attacco. Per offrire il servizio a utenti non fidati, aggiungi scansione antivirus e parsing in worker isolati con limiti CPU/memoria e aggiornamenti dei parser. Questa versione ammette solo amministratori esplicitamente abilitati, impone limiti per file/testo e non promette un antivirus incluso. Controlla anche quote globali Storage e budget del provider: non esiste un sistema di billing o di quota giornaliera multi-tenant.

## Versionamento e crash

Hash calcolato sui byte effettivi, unicità per utente, versioni numerate per documento e locatori originali. Prenotazione e numerazione avvengono in RPC transazionale con lock sul documento. Lease per l’estrazione e commit atomico dei segmenti: nessun testo parziale viene esposto nel retrieval. Le versioni indicizzate precedenti restano consultabili finché la nuova non è approvata e indicizzata. La sostituzione dell’indice full-text è atomica; gli embeddings sono aggiornati in lotti idempotenti e possono essere ripresi dopo un errore del provider.

Full-text e indice semantico sono materializzati in `material_chunks`. Le citazioni includono ID documento/versione, pagina PDF o sezione DOCX, ID chunk e offset; i chunk non attraversano pagine/sezioni. Gli offset si riferiscono al testo estratto (non a un byte offset nel PDF). Gli estratti restituiti dal tutor sono limitati a quattro passaggi da 600 caratteri. Il filtro per fonte è applicato nel database, insieme a RLS, prima del ranking e del limite.

## OAuth e segreti

Le API Google sono ufficiali. Nessun token di ChatGPT è usato. Il consenso Google resta più ampio del folder ID e questo limite è esplicito nella guida. Il server blocca destinazioni diverse dall’API Drive prevista e non accetta URL o folder ID arbitrari dal client.

I token access/refresh vengono cifrati AES-256-GCM con chiave server, IV casuale e autenticazione del ciphertext, nello schema non esposto `academy_private`. Nessun accesso `anon`/`authenticated`, nemmeno per un amministratore. Tre RPC ristrette per lettura/scrittura/cancellazione sono eseguibili solo dal ruolo server `service_role`. Il server le usa con l’ID dell’utente autenticato, mai con un ID fornito dal browser. La service-role key non è usata per saltare RLS nell’upload, nell’indicizzazione o nella ricerca.

Lo stato OAuth è monouso nel browser (cookie eliminato al callback), HttpOnly, SameSite=Lax, Secure in produzione, dieci minuti, legato a utente e PKCE. HTTPS, redirect canonico configurato e token non inseriti in log, URL applicativi, export o repository. Errori dei provider sanitizzati; il registro conserva messaggi operativi, non corpi delle risposte contenenti credenziali.

## Consenso, copyright e approvazione

L’amministratore conferma i diritti prima di caricare o sincronizzare. Non basta per attribuire una licenza reale: l’operatore resta responsabile dell’uso consentito. Nessun libro è redistribuito tra utenti, in una cartella pubblica o nel repository. Anche la «pubblicazione didattica» è soltanto nell’account privato del proprietario.

Invio a servizi esterni disattivato per documento salvo consenso esplicito. Revocandolo, vengono rimossi gli embeddings memorizzati e bloccate nuove elaborazioni esterne; questo non cancella dati già trattati dal provider, soggetti ai suoi termini. La ricerca semantica invia anche la domanda al provider solo su scelta esplicita. OCR esterno può ricevere l’intero originale, dichiarato in interfaccia e documentazione. Sintesi AI riceve estratti limitati e viene bloccata se manca il consenso di una fonte importata.

Estratti e domanda sono dati non affidabili, non istruzioni di sistema. Le citazioni AI sono validate letteralmente sui passaggi recuperati. Il controllo non certifica che la conclusione sia corretta o che le norme siano vigenti. Nessuna fonte viene marcata verificata automaticamente. Generazione AI crea sempre una bozza. L’approvazione umana con nota è necessaria per renderla disponibile negli strumenti di studio; modificarla la ritira e richiede nuova approvazione.

## Eliminazione ed esportazione

Eliminare una versione rimuove originale e dati dipendenti. La cancellazione dell’account rimuove prima i suoi originali, poi l’identità e le tabelle in cascata. La RPC ristretta `own_material_cleanup_paths()` espone soltanto i path del chiamante per la cancellazione; le policy di lettura/eliminazione degli originali propri non richiedono un ruolo amministratore ancora attivo, così la rimozione dei propri dati resta possibile dopo una revoca. Non cancellare metadata a mano lasciando oggetti orfani nel bucket.

L’export JSON del vecchio archivio contiene progressi/appunti, non gli originali privati, i token OAuth o i vettori. Per backup completo usa le procedure Supabase autorizzate di database e Storage con permessi coerenti, cifratura e conservazione adeguata. La revoca Google va effettuata separatamente dalla cancellazione del solo account Supabase se non hai usato il pulsante di disconnessione.
