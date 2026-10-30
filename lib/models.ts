export type Verification = "unverified" | "verified" | "outdated";
export type Provenance = "manual" | "ai" | "official" | "demo" | "personal";
export interface SourceRef {
  title?: string;
  section?: string;
  quote?: string;
  documentId?: string;
  page?: number;
  version: string;
  provenance: Provenance;
  verification: Verification;
}
export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
}
export interface Topic {
  id: string;
  title: string;
  description: string;
}
export interface Lesson {
  id: string;
  topicId: string;
  title: string;
  body: string;
  glossary: Record<string, string>;
  example: string;
  source: SourceRef;
}
export interface DocumentRecord {
  id: string;
  title: string;
  text: string;
  tags: string[];
  createdAt: string;
  source: SourceRef;
}
export interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  page: number;
  version: string;
}
export interface LegalSource {
  id: string;
  title: string;
  url: string;
  article: string | null;
  effective_date: string | null;
  verification: Verification;
  version: string;
  history: string[];
}
export interface AnswerOption {
  id: string;
  text: string;
}
export interface Question {
  id: string;
  topicId: string;
  prompt: string;
  options: AnswerOption[];
  correctOptionId: string;
  explanation: string;
  difficulty: "base" | "intermedia" | "avanzata";
  source: SourceRef;
}
export interface Attempt {
  id: string;
  questionId: string;
  topicId: string;
  selectedOptionId: string;
  correct: boolean;
  seconds: number;
  at: string;
}
export interface StudySession {
  id: string;
  kind: "lesson" | "quiz" | "written" | "oral" | "review";
  topicId?: string;
  minutes: number;
  at: string;
  label: string;
}
export interface Flashcard {
  id: string;
  topicId: string;
  front: string;
  back: string;
  source: SourceRef;
}
export interface Review {
  cardId: string;
  repetitions: number;
  interval: number;
  ease: number;
  due: string;
  reviewedAt?: string;
  quality?: number;
}
export interface Case {
  steps?: string[];
  id: string;
  title: string;
  scenario: string;
  source: SourceRef;
}
export interface WrittenSubmission {
  id: string;
  text: string;
  updatedAt: string;
  caseId: string;
}
export interface StudyGoal {
  weeklyMinutes: number;
}
export interface StudyState {
  attempts: Attempt[];
  sessions: StudySession[];
  reviews: Record<string, Review>;
  completedLessons: string[];
  documents: DocumentRecord[];
  written: WrittenSubmission;
  goal: StudyGoal;
  oralNotes: string;
  oralRatings: number[];
  writtenChecks: boolean[];
  legalSources: LegalSource[];
  simulation: {
    count: number;
    minutes: number;
    correct: number;
    wrong: number;
    blank: number;
  };
}
