import { z } from "zod";

export const MAX_NOTES = 20_000;
export const MAX_STUDY_SETS = 1_000;
export const folderSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine((id) => id !== "all" && id !== "unfiled", "Reserved folder ID"),
  name: z.string().trim().min(1).max(50),
});
export const cardScheduleSchema = z.object({
  dueAt: z.iso.datetime({ offset: true }),
  lastReviewedAt: z.iso.datetime({ offset: true }),
  intervalDays: z.number().int().min(0).max(365),
  repetitions: z.number().int().min(0).max(100_000),
  lapses: z.number().int().min(0).max(100_000),
});
const text = z.string().trim().min(1).max(2000);
const sources = z.array(z.number().int().positive()).min(1).max(20);
const cited = z.object({ text, sources });
const flashcard = z.object({ question: text, answer: text, sources });
const question = z
  .object({
    question: text,
    options: z.array(z.string().trim().min(1).max(500)).length(4),
    correct_index: z.number().int().min(0).max(3),
    explanation: text,
    simpler_example: text,
    sources,
  })
  .refine(
    (q) => new Set(q.options.map((o) => o.toLowerCase())).size === 4,
    "Options must differ",
  );

export const materialsSchema = z
  .object({
    status: z.enum(["ready", "insufficient"]),
    message: z.string().trim().min(1).max(600),
    summary: z.array(cited).max(6),
    concepts: z.array(cited).max(8),
    definitions: z
      .array(
        z.object({ term: z.string().min(1).max(150), meaning: text, sources }),
      )
      .max(8),
    flashcards: z.array(flashcard).max(10),
    quiz: z.array(question).max(5),
  })
  .superRefine((m, ctx) => {
    const all = [
      ...m.summary,
      ...m.concepts,
      ...m.definitions,
      ...m.flashcards,
      ...m.quiz,
    ];
    if (m.status === "insufficient" && all.length)
      ctx.addIssue({
        code: "custom",
        message: "Insufficient notes must have no generated items",
      });
    if (
      m.status === "ready" &&
      (!m.summary.length || !m.flashcards.length || !m.quiz.length)
    )
      ctx.addIssue({ code: "custom", message: "Missing study materials" });
    for (const list of [m.flashcards, m.quiz]) {
      if (
        new Set(list.map((i) => i.question.toLowerCase())).size !== list.length
      )
        ctx.addIssue({ code: "custom", message: "Repeated questions" });
    }
  });

export const generationSchema = z
  .object({
    id: z.string(),
    notes: z.string().max(MAX_NOTES),
    createdAt: z.string(),
    materials: materialsSchema,
  })
  .superRefine((g, ctx) => {
    const count = paragraphs(g.notes).length;
    for (const item of [
      ...g.materials.summary,
      ...g.materials.concepts,
      ...g.materials.definitions,
      ...g.materials.flashcards,
      ...g.materials.quiz,
    ]) {
      if (
        item.sources.some((n) => n > count) ||
        new Set(item.sources).size !== item.sources.length
      )
        ctx.addIssue({ code: "custom", message: "Invalid source reference" });
    }
  });

const attemptSchema = z
  .object({
    id: z.string(),
    generationId: z.string(),
    createdAt: z.string(),
    kind: z.enum(["full", "retry"]),
    questions: z.array(question).min(1).max(5),
    answers: z.array(z.number().int().min(0).max(3)).min(1).max(5),
  })
  .refine(
    (a) => a.questions.length === a.answers.length,
    "Every question needs an answer",
  );

export const studySetSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(100),
    subject: z.string().trim().min(1).max(60),
    notes: z.string().trim().min(1).max(MAX_NOTES),
    createdAt: z.string(),
    updatedAt: z.string(),
    folderId: z.string().min(1).max(120).nullable().default(null),
    tags: z.array(z.string().trim().min(1).max(24)).max(10).default([]),
    generation: generationSchema.nullable(),
    cardReviews: z.record(z.string(), z.enum(["got-it", "review"])),
    cardSchedule: z.record(z.string(), cardScheduleSchema).default({}),
    attempts: z.array(attemptSchema).max(100),
    quizDraft: z
      .object({
        generationId: z.string(),
        kind: z.enum(["full", "retry"]),
        indices: z.array(z.number().int().min(0).max(4)).min(1).max(5),
        answers: z
          .array(z.number().int().min(0).max(3).nullable())
          .min(1)
          .max(5),
      })
      .nullable(),
  })
  .superRefine((s, ctx) => {
    if (new Set(s.tags.map((tag) => tag.toLowerCase())).size !== s.tags.length)
      ctx.addIssue({ code: "custom", message: "Tags must be unique" });
    if (
      Object.entries(s.cardSchedule).some(
        ([key, schedule]) =>
          !/^(0|[1-9]\d*)$/.test(key) ||
          Number(key) >= (s.generation?.materials.flashcards.length ?? 0) ||
          Date.parse(schedule.dueAt) < Date.parse(schedule.lastReviewedAt),
      )
    )
      ctx.addIssue({ code: "custom", message: "Invalid flashcard schedule" });
    if (
      Object.keys(s.cardReviews).some(
        (k) =>
          !/^(0|[1-9]\d*)$/.test(k) ||
          Number(k) >= (s.generation?.materials.flashcards.length ?? 0),
      )
    )
      ctx.addIssue({ code: "custom", message: "Invalid card review" });
    const d = s.quizDraft;
    if (
      d &&
      (d.generationId !== s.generation?.id ||
        d.indices.length !== d.answers.length ||
        new Set(d.indices).size !== d.indices.length ||
        d.indices.some((i) => i >= (s.generation?.materials.quiz.length ?? 0)))
    )
      ctx.addIssue({ code: "custom", message: "Invalid quiz draft" });
  });

export type Materials = z.infer<typeof materialsSchema>;
export const librarySchema = z
  .object({
    version: z.literal(1),
    seedVersion: z.number().int().min(0).default(0),
    folders: z.array(folderSchema).max(100).default([]),
    sets: z.array(studySetSchema).max(MAX_STUDY_SETS),
  })
  .superRefine((library, ctx) => {
    const folderIds = new Set(library.folders.map((folder) => folder.id));
    if (
      folderIds.size !== library.folders.length ||
      new Set(library.folders.map((folder) => folder.name.toLowerCase()))
        .size !== library.folders.length ||
      new Set(library.sets.map((set) => set.id)).size !== library.sets.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate folder names or record IDs",
      });
    if (
      library.sets.some(
        (set) => set.folderId !== null && !folderIds.has(set.folderId),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "A study set refers to a missing folder",
      });
  });
export type Folder = z.infer<typeof folderSchema>;
export type Library = z.infer<typeof librarySchema>;
export type CardSchedule = z.infer<typeof cardScheduleSchema>;
export type Flashcard = Materials["flashcards"][number];
export type Question = Materials["quiz"][number];
export type StudySet = z.infer<typeof studySetSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type QuizDraft = NonNullable<StudySet["quizDraft"]>;
export type Tab = "Summary" | "Flashcards" | "Quiz" | "Progress";

export function paragraphs(notes: string): string[] {
  return notes
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
