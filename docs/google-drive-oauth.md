# Google Drive: OAuth indipendente e sincronizzazione manuale

La connessione Drive di ChatGPT non viene trasferita a DS Academy. Non vengono riutilizzati cookie o token di ChatGPT. Nessuna sincronizzazione è dichiarata attiva finché non sono presenti credenziali valide, consenso Google e accesso effettivo alla cartella.

Cartella consentita lato server: `19aoZG0ZMaQuagaOFdNZTMOoRcIbBSVx5`, PREPARAZIONE CONCORSO DIRIGENTE 2027. L’inventario viene letto realmente tramite API, non precaricato con il numero 38. La sincronizzazione considera i figli diretti, non attraversa sottocartelle.

## Configurazione Google Cloud

1. Crea o seleziona un progetto Google Cloud e abilita **Google Drive API**.
2. Configura la schermata consenso OAuth: nome, proprietario, contatti, domini e informativa privacy appropriata all’istanza.
3. Se l’app è in Testing, aggiungi il tuo account Google tra i test user. Deve essere lo stesso account che può leggere la cartella, o un altro account a cui l’hai condivisa. In Testing i refresh token con scope Drive possono scadere dopo sette giorni: riconnetti o completa il percorso di pubblicazione/verifica Google applicabile.
4. Crea un client OAuth **Web application**.
5. Aggiungi questo URI di redirect autorizzato, sostituendo il dominio:
   `https://TUO-DOMINIO.vercel.app/api/drive/callback`
6. Usa un dominio canonico stabile per `APP_URL`; aggiungi separatamente eventuali domini Preview autorizzati. Il browser non può scegliere un redirect arbitrario.

## Scope minimo per il workflow implementato

L’app richiede soltanto `https://www.googleapis.com/auth/drive.readonly`: nessun permesso di scrittura, cancellazione, modifica o invio email. Questo scope è ristretto da Google e può richiedere verifica dell’app secondo modalità d’uso e distribuzione.

**Limite reale dei permessi Google:** non esiste uno scope OAuth di sola lettura limitato a un singolo folder ID. `drive.readonly` può tecnicamente leggere il Drive autorizzato; l’app applica una restrizione aggiuntiva alla sola cartella indicata, verifica il parent di ogni file prima e dopo il download e non accetta folder ID dal client. Questa restrizione applicativa non riduce il grant effettivo detenuto dal token.

Lo scope più ristretto `drive.file` richiederebbe una selezione/autorizzazione dei singoli file tramite Picker e non garantirebbe l’inventario completo dei file preesistenti selezionando solo la cartella. Tale workflow Picker non è implementato. Se non vuoi concedere `drive.readonly`, usa il caricamento manuale privato: non viene richiesto di allargare i permessi per usare PDF/DOCX.

## Variabili server in Vercel

- `APP_URL`: origine HTTPS canonica, senza path.
- `GOOGLE_CLIENT_ID`: client ID del client Web.
- `GOOGLE_CLIENT_SECRET`: segreto del client, mai nel browser.
- `DRIVE_TOKEN_ENCRYPTION_KEY`: 32 byte casuali codificati base64.
- `SUPABASE_SERVICE_ROLE_KEY`: soltanto server, per le RPC ristrette dei token OAuth cifrati. Non aggiungere `NEXT_PUBLIC_`.
- Le variabili pubblicabili Supabase già configurate.

Per generare **localmente** la chiave di cifratura puoi usare `openssl rand -base64 32`; incolla il valore direttamente nelle variabili sicure Vercel, non in chat o GitHub. Una sua rotazione rende i vecchi token indecifrabili: revoca le vecchie autorizzazioni e riconnetti gli account. Se desideri una rotazione senza riconnessione, implementa prima una procedura controllata di ricifratura.

Dopo le variabili esegui un nuovo deployment. In Materiali privati il pannello mostra separatamente «configurato» e «account autorizzato». Premi **Autorizza Google Drive** e completa il consenso. Il callback usa PKCE S256, stato casuale cifrato con scadenza di dieci minuti e legame all’utente Supabase autenticato. Non serve conoscere o copiare un access token manualmente.

## Sincronizzazione

Conferma i diritti d’uso, poi premi **Sincronizza manualmente**. La prima fase legge metadata paginati dalla cartella. Sono scaricati soltanto PDF/DOCX nuovi o modificati, confrontando versione Google e data di modifica. Gli invariati vengono saltati; gli errori precedenti ritentati alla prossima scoperta. JSX, Google Docs nativi e formati diversi vengono registrati come non supportati, mai eseguiti.

La seconda fase scarica un file per richiesta, ricontrolla appartenenza alla cartella, versione e dimensione, verifica il checksum Google se disponibile e salva l’originale nel bucket privato. La pipeline calcola inoltre SHA-256 sui byte effettivi. I lavori di estrazione restano separati e richiedono avvio/revisione nel pannello.

Ogni sincronizzazione conserva conteggi, avvio, fine, file saltati ed errori. Una chiusura della pagina interrompe le richieste del browser: usa **Riprendi sincronizzazione**, non presumere un worker attivo. I download hanno lease riprendibili; una scoperta interrotta può essere annullata e rilanciata. Non vengono fatte rimozioni locali sulla base di un inventario fallito. I file non più presenti in una scoperta completa sono marcati `remote_removed`; la copia privata non viene cancellata automaticamente.

**Disconnetti e revoca** richiede la revoca a Google, poi elimina il token cifrato locale. Gli originali già importati restano nel tuo archivio fino all’eliminazione esplicita. Se Google non conferma la revoca viene mostrato un errore; puoi revocare anche dalle connessioni di terze parti del tuo account Google. La cancellazione dell’account Supabase elimina i token locali in cascata, ma non sostituisce la revoca della concessione presso Google.

## Rete e verifica

Destinazioni necessarie al runtime: `accounts.google.com`, `oauth2.googleapis.com`, `www.googleapis.com`, il tuo progetto Supabase, ed eventualmente `api.openai.com` e il tuo host OCR. Usa HTTPS con verifica TLS; non disabilitare il proxy o la verifica dei certificati per superare un blocco.

I test automatizzati verificano il contratto OAuth con risposte simulate. Nessun accesso reale alla cartella è stato provato in assenza di credenziali e autorizzazione dell’app. Prima dell’uso verifica consenso, refresh, inventario, file modificato, file rimosso, errore di accesso e revoca con il tuo progetto Google reale.
