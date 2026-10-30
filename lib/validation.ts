import { z } from "zod";
export const sourceSchema = z.object({
  title: z.string().max(180).optional(),
  section: z.string().max(500).optional(),
  quote: z.string().max(600).optional(),
  documentId: z.string().optional(),
  page: z.number().int().positive().optional(),
  version: z.string().min(1),
  provenance: z.enum(["manual", "ai", "official", "demo", "personal"]),
  verification: z.enum(["unverified", "verified", "outdated"]),
});
export const documentSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(3).max(180),
  text: z.string().trim().min(30).max(150000),
  tags: z.array(z.string().max(40)).max(10),
  createdAt: z.iso.datetime(),
  source: sourceSchema,
});
export const stateSchema = z.object({
  attempts: z
    .array(
      z.object({
        id: z.string(),
        questionId: z.string(),
        topicId: z.string(),
        selectedOptionId: z.string(),
        correct: z.boolean(),
        seconds: z.number().nonnegative(),
        at: z.iso.datetime(),
      }),
    )
    .max(20000),
  sessions: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(["lesson", "quiz", "written", "oral", "review"]),
        topicId: z.string().optional(),
        minutes: z.number().nonnegative(),
        at: z.iso.datetime(),
        label: z.string(),
      }),
    )
    .max(20000),
  reviews: z.record(
    z.string(),
    z.object({
      cardId: z.string(),
      repetitions: z.number().int().nonnegative(),
      interval: z.number().nonnegative(),
      ease: z.number().min(1.3),
      due: z.iso.datetime(),
      reviewedAt: z.iso.datetime().optional(),
      quality: z.number().min(0).max(5).optional(),
    }),
  ),
  completedLessons: z.array(z.string()),
  documents: z.array(documentSchema).max(100),
  written: z.object({
    id: z.string(),
    text: z.string().max(100000),
    updatedAt: z.string(),
    caseId: z.string(),
  }),
  goal: z.object({ weeklyMinutes: z.number().int().min(15).max(2400) }),
  oralNotes: z.string().max(100000),
  oralRatings: z
    .array(z.number().int().min(0).max(5))
    .length(5)
    .default([0, 0, 0, 0, 0]),
  writtenChecks: z
    .array(z.boolean())
    .length(4)
    .default([false, false, false, false]),
  legalSources: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().min(3).max(180),
        url: z.url().refine((value) => value.startsWith("https://")),
        article: z.string().nullable(),
        effective_date: z.string().nullable(),
        verification: z.enum(["unverified", "verified", "outdated"]),
        version: z.string().min(1),
        history: z.array(z.string()),
      }),
    )
    .max(500)
    .default([]),
  simulation: z.object({
    count: z.number().int().min(1).max(100),
    minutes: z.number().int().min(1).max(240),
    correct: z.number().min(-10).max(10),
    wrong: z.number().min(-10).max(10),
    blank: z.number().min(-10).max(10),
  }),
});
export const tutorSchema = z.object({
  query: z.string().trim().min(3).max(1000),
});
