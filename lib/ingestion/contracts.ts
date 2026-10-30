import { z } from "zod";
export const DRIVE_FOLDER_ID = "19aoZG0ZMaQuagaOFdNZTMOoRcIbBSVx5";
export const BUCKET = "academy-materials";
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PAGES = 1500;
export const PDF_MIME = "application/pdf";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const areaIds = [
  "organizzazione",
  "gestione",
  "programmazione",
  "diritto",
  "amministrazione",
  "lavoro",
  "didattica",
  "digitale",
  "europa",
] as const;
export type AreaId = (typeof areaIds)[number];
export const segmentSchema = z.object({
  ordinal: z.number().int().min(0),
  page: z.number().int().min(1).max(MAX_PAGES).nullable(),
  section: z.string().max(500),
  text: z.string().max(100000),
  kind: z.enum(["text", "table", "ocr"]),
});
export type Segment = z.infer<typeof segmentSchema>;
export interface ExtractedBatch {
  segments: Segment[];
  nextCursor: number;
  done: boolean;
  pageCount: number | null;
  warnings: string[];
  metadata: Record<string, unknown>;
}
export interface Material {
  id: string;
  title: string;
  area: AreaId | null;
  verification: "unverified" | "verified" | "outdated";
  source: "upload" | "drive";
  source_id: string | null;
  external_consent: boolean;
  created_at: string;
}
export type ImportStatus =
  | "uploaded"
  | "processing"
  | "needs_ocr"
  | "review"
  | "indexing"
  | "indexed"
  | "error"
  | "duplicate";
export interface MaterialVersion {
  id: string;
  material_id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  byte_size: number;
  sha256: string | null;
  version: number;
  status: ImportStatus;
  cursor: number;
  page_count: number | null;
  warnings: string[];
  error_message: string | null;
  embedding_model: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  materials?: Material;
}
export interface IndexedChunk {
  ordinal: number;
  page: number | null;
  section: string;
  content: string;
  start: number;
  end: number;
  embedding?: number[];
}
export interface RetrievedSource {
  document_id: string;
  version_id: string;
  chunk_id: string;
  title: string;
  page: number | null;
  section: string;
  version: string;
  content: string;
  verification: string;
  rank: number;
}
export const uploadSchema = z.object({
  fileName: z
    .string()
    .min(1)
    .max(200)
    .refine((v) => !/[\/\\\x00-\x1f]/.test(v), "Nome file non valido"),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  mimeType: z.enum([PDF_MIME, DOCX_MIME]),
  title: z.string().trim().min(3).max(180),
  materialId: z.uuid().optional(),
  licenseConfirmed: z.literal(true),
  externalConsent: z.boolean().default(false),
});
export const reviewSchema = z.object({
  versionId: z.uuid(),
  action: z.enum([
    "approve",
    "classify",
    "edit",
    "retry",
    "ocr",
    "delete",
    "consent",
  ]),
  area: z.enum(areaIds).optional(),
  externalConsent: z.boolean().optional(),
  segment: z
    .object({
      ordinal: z.number().int().nonnegative(),
      text: z.string().max(100000),
    })
    .optional(),
});
export const searchSchema = z.object({
  query: z.string().trim().min(3).max(1000),
  sourceIds: z.array(z.uuid()).max(20).default([]),
  semantic: z.boolean().default(false),
});
export const draftBodySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("quiz"),
      title: z.string().min(3).max(200),
      prompt: z.string().min(10).max(1500),
      options: z
        .array(
          z.object({
            id: z.string().min(1).max(60),
            text: z.string().min(1).max(500),
          }),
        )
        .length(4),
      correctOptionId: z.string(),
      explanation: z.string().max(1500),
    })
    .refine(
      (v) =>
        new Set(v.options.map((o) => o.id)).size === 4 &&
        v.options.some((o) => o.id === v.correctOptionId),
      "Identificativi delle opzioni non validi",
    ),
  z.object({
    kind: z.literal("flashcard"),
    title: z.string().min(3).max(200),
    front: z.string().min(3).max(1000),
    back: z.string().min(3).max(1500),
  }),
  z.object({
    kind: z.literal("summary"),
    title: z.string().min(3).max(200),
    body: z.string().min(10).max(5000),
  }),
  z.object({
    kind: z.literal("case"),
    title: z.string().min(3).max(200),
    scenario: z.string().min(10).max(3000),
    steps: z.array(z.string().min(3).max(500)).length(5),
  }),
]);
export const draftSchema = z.object({
  versionId: z.uuid(),
  body: draftBodySchema,
  citations: z
    .array(
      z.object({
        segmentOrdinal: z.number().int().nonnegative(),
        quote: z.string().min(10).max(600),
      }),
    )
    .min(1)
    .max(4),
});
export type TeachingDraft = {
  id: string;
  material_id: string;
  version_id: string;
  body: z.infer<typeof draftBodySchema>;
  citations: { segmentOrdinal: number; quote: string }[];
  status: "draft" | "approved" | "rejected";
  provenance: "personal" | "ai";
  review_note: string | null;
  created_at: string;
};
