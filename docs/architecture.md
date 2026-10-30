# Architettura e sicurezza dei dati

La shell client coordina undici moduli indipendenti e lo stato tipizzato. L’URL `?section=` supporta link diretti e cronologia. I componenti server ospitano layout, metadati ed endpoint; chiavi AI e sessioni remote non entrano nel bundle applicativo.

## Persistenza

La demo usa un unico archivio JSON versionato nel localStorage. Importazioni e caricamenti passano da Zod; un archivio corrotto non viene sovrascritto. Il salvataggio parte entro circa 800 ms, segnala errori e impedisce la chiusura silenziosa quando ci sono modifiche non salvate. Limite dell’archivio remoto: 2,5 MB applicativi / 3 MB DB. I file .txt sono limitati a 600 KB e il testo per documento a 150.000 caratteri.

Con Supabase, `profiles.study_state` è il **modello canonico usato dalla UI**. Contiene quiz dimostrativi con ID stabili testuali, progressi, bozze, griglie, fonti personali e obiettivi. `profiles.revision` implementa compare-and-swap: due dispositivi non sovrascrivono silenziosamente revisioni già salvate. Non esiste ancora collaborazione realtime. Due tab demo possono sovrascriversi: usare un tab alla volta o esportare prima del cambio.

Le 15 tabelle private oltre ad `auth.users` definiscono il modello relazionale completo richiesto. Documenti e chunk sono materializzati dalla RPC di salvataggio per la ricerca full-text; i restanti progressi UI restano nel JSON canonico, **non si dichiarano popolate le tabelle relazionali attempts/reviews/lessons ecc.** Queste supportano contenuti curati e una futura migrazione del modello di lettura. Non modificare documenti normalizzati direttamente mentre la UI usa lo snapshot; aggiungere contenuti relazionali referenzianti documenti richiede un servizio di sincronizzazione dedicato prima di usare la cancellazione dalla UI.

## Isolamento

Tutte le tabelle pubbliche hanno RLS e policy per `auth.uid()`; nessuna policy pubblica. `profiles.id` riferisce l’identità Auth, le altre tabelle hanno `user_id`. Le FK composite `(parent_id,user_id)` vietano riferimenti a righe appartenenti ad altri utenti. La risposta corretta è vincolata alle opzioni della stessa domanda con FK differita, non alla posizione della risposta.

Le RPC di salvataggio e ricerca sono security invoker. `delete_own_account` è security definer con search_path vuoto, non accetta un ID e cancella solo `auth.uid()`; i dati dipendenti vengono eliminati in cascata. La cancellazione permanente può essere impedita da servizi Supabase esterni eventualmente collegati in seguito (per esempio oggetti Storage); non viene dichiarato un supporto Storage che qui non esiste.

La chiave pubblicabile Supabase nel client non è un segreto. Non servono chiavi service-role. Gli endpoint verificano l’identità con `getUser()`, validano i dati prima del salvataggio e propagano gli errori senza mostrare credenziali. Cancellazione dati/account sempre con conferma esplicita. I server non eseguono URL forniti nei documenti; i link sono soltanto HTTPS e aperti con `noopener noreferrer`.

## Retrieval e AI

Demo: ricerca lessicale nel testo locale. Account: segmentazione per pagina (form feed) e chunk di 1.200 caratteri, ricerca italiana full-text con ranking Postgres. È un RAG lessicale, non una ricerca vettoriale o semantica. Nessun OCR o estrattore PDF. La sintesi opzionale vede massimo quattro chunk, riceve istruzioni di astensione e separazione tra istruzioni e dati, restituisce JSON validato. L’esistenza degli identificativi delle citazioni viene controllata; il supporto effettivo della conclusione richiede comunque revisione umana.

## Accessibilità

HTML semantico, lingua italiana, skip link, focus visibile, etichette dei form, fieldset radio, pulsanti nativi, stato dei salvataggi annunciato, progressbar accessibili, caricamento ed errori espliciti. Layout mobile con menu apribile da pulsante e chiusura esplicita; animazioni disattivate con prefers-reduced-motion. I controlli axe non sostituiscono una verifica manuale con screen reader.

## Estensione materiali (migrations 002/003)

L’acquisizione PDF/DOCX usa un modello normalizzato separato: materials, versioni, segmenti, chunk full-text/pgvector, eventi, bozze e sincronizzazioni Drive. Non viene inserita nello snapshot JSON e non viene cancellata da save_workspace. Il tutor cerca anche queste fonti con filtri applicati nel DB; l’accesso è limitato al proprietario amministratore. I paragrafi precedenti sul retrieval soltanto lessicale descrivono il percorso legacy .txt, mantenuto compatibile. Vedi docs/materials-setup.md e docs/materials-security.md per lo stato attuale completo.
