# Piano iniziale e migrazione del prototipo

Il 30 ottobre 2026 il checkout `mrandrea2/AccademiaDS` non conteneva commit; `git ls-remote --symref origin` riusciva senza riferimenti. La ricerca sotto `/workspace` non ha trovato `PreparazioneDS2027.jsx`. Non esistono quindi funzionalità precedenti ispezionabili da eliminare o dati normativi da considerare attendibili.

Il piano comunicato prima di scrivere codice:

1. Creare App Router, TypeScript strict, componenti accessibili e modelli con provenienza, pagina/versione e stato di verifica.
2. Implementare strumenti di studio in italiano, archivio locale esplicito e integrazione privata Supabase.
3. Aggiungere schema relazionale e RLS, test, documentazione e verifica della build.

Se il prototipo viene fornito successivamente: conservarne una copia, inventariare aree/quiz/spiegazioni e comportamenti, confrontare ogni funzionalità con i moduli implementati, importare in un ambiente di staging gli elementi validi mantenendo ID, documenti, pagine e versioni. Ogni affermazione normativa resta non verificata finché non è stata confrontata con una fonte primaria pertinente. Non rimpiazzare gli ID corretti con indici delle opzioni randomizzate. Non dismettere comportamenti precedenti senza confronto funzionale.
