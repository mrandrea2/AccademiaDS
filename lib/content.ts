import type {
  Case,
  Flashcard,
  Lesson,
  Question,
  SourceRef,
  StudyState,
  Topic,
} from "./models";
export const demoSource: SourceRef = {
  version: "demo-1",
  provenance: "demo",
  verification: "unverified",
};
export const topics: Topic[] = [
  {
    id: "organizzazione",
    title: "Organizzazione e sistema educativo",
    description: "Autonomia, istituzioni e governo della scuola.",
  },
  {
    id: "gestione",
    title: "Gestione e leadership",
    description: "Decisioni, persone e miglioramento organizzativo.",
  },
  {
    id: "programmazione",
    title: "Programmazione e valutazione",
    description: "Progettazione, evidenze e qualità dei processi.",
  },
  {
    id: "diritto",
    title: "Diritto e responsabilità",
    description: "Fonti, procedimenti e responsabilità da verificare.",
  },
  {
    id: "amministrazione",
    title: "Amministrazione e contabilità",
    description: "Risorse, trasparenza e gestione documentale.",
  },
  {
    id: "lavoro",
    title: "Lavoro e relazioni sindacali",
    description: "Organizzazione del personale e relazioni professionali.",
  },
  {
    id: "didattica",
    title: "Didattica e inclusione",
    description: "Apprendimenti, accessibilità e partecipazione.",
  },
  {
    id: "digitale",
    title: "Innovazione e competenze digitali",
    description: "Dati, strumenti e trasformazione dei servizi.",
  },
  {
    id: "europa",
    title: "Europa e sistemi educativi",
    description: "Confronto tra sistemi e dimensione internazionale.",
  },
];
export const lessons: Lesson[] = topics.map((t) => ({
  id: `lezione-${t.id}`,
  topicId: t.id,
  title: `Studiare ${t.title.toLocaleLowerCase("it")}`,
  body: `Questa scheda dimostrativa propone un metodo di studio per l’area «${t.title}». Parti da una situazione concreta, identifica il problema, raccogli le fonti aggiornate e confronta possibili decisioni. Separa i fatti dalle ipotesi e documenta le informazioni che mancano. Questa scheda non contiene una sintesi normativa e non certifica la corrispondenza con un bando. Aggiungi i tuoi materiali in Biblioteca per approfondire.`,
  glossary: {
    Evidenza:
      "Informazione documentata utilizzata per motivare una valutazione.",
    Indicatore: "Misura scelta per osservare il cambiamento nel tempo.",
  },
  example:
    "Un gruppo di lavoro rileva una partecipazione discontinua. Prima di intervenire, raccoglie dati sulle presenze e ascolta i partecipanti; definisce poi un obiettivo osservabile e una data di verifica.",
  source: demoSource,
}));
export const questions: Question[] = topics.map((t, i) => ({
  id: `q-${t.id}`,
  topicId: t.id,
  prompt: `In un caso di ${t.title.toLocaleLowerCase("it")}, quale primo passo rende una decisione meglio motivata?`,
  options: [
    {
      id: `${i}-evidenze`,
      text: "Raccogliere fatti, fonti pertinenti e informazioni mancanti.",
    },
    {
      id: `${i}-abitudine`,
      text: "Applicare una soluzione abituale senza analizzare il contesto.",
    },
    {
      id: `${i}-rinvio`,
      text: "Rinviare ogni valutazione senza definire una scadenza.",
    },
    {
      id: `${i}-opinione`,
      text: "Considerare una sola opinione come prova sufficiente.",
    },
  ],
  correctOptionId: `${i}-evidenze`,
  explanation:
    "Questo esercizio di metodo premia la raccolta delle evidenze. Non è un quesito ufficiale e non verifica conoscenze normative.",
  difficulty: i < 3 ? "base" : i < 6 ? "intermedia" : "avanzata",
  source: demoSource,
}));
export const flashcards: Flashcard[] = topics.map((t) => ({
  id: `fc-${t.id}`,
  topicId: t.id,
  front: `Quale sequenza puoi usare per analizzare un caso di ${t.title.toLocaleLowerCase("it")}?`,
  back: "Problema → fatti e fonti → opzioni → decisione motivata → verifica degli esiti. Schema didattico dimostrativo, non prescrizione normativa.",
  source: demoSource,
}));
export const cases: Case[] = [
  {
    id: "caso-collaborazione",
    title: "Un gruppo di lavoro in difficoltà",
    scenario:
      "Scenario didattico inventato. Un gruppo di docenti segnala riunioni poco efficaci e compiti distribuiti in modo disomogeneo. La partecipazione cala e due progetti rischiano un ritardo. Come imposteresti un intervento, distinguendo i fatti da accertare, le responsabilità da verificare e gli indicatori di risultato?",
    source: demoSource,
  },
  {
    id: "caso-accessibilita",
    title: "Un servizio digitale poco accessibile",
    scenario:
      "Scenario didattico inventato. Alcune famiglie non riescono a utilizzare un nuovo servizio digitale scolastico. Proponi un’analisi delle barriere, il coinvolgimento degli interessati e un piano di miglioramento misurabile. Quali fonti consulteresti prima di formulare conclusioni giuridiche?",
    source: demoSource,
  },
];
export function emptyState(): StudyState {
  return {
    attempts: [],
    sessions: [],
    reviews: {},
    completedLessons: [],
    documents: [],
    written: { id: "bozza", text: "", updatedAt: "", caseId: cases[0].id },
    goal: { weeklyMinutes: 150 },
    oralNotes: "",
    oralRatings: [0, 0, 0, 0, 0],
    writtenChecks: [false, false, false, false],
    legalSources: [],
    simulation: { count: 5, minutes: 10, correct: 1, wrong: 0, blank: 0 },
  };
}
