import library from "../data/study-sets.json";
import { MAX_STUDY_SETS, studySetSchema, type StudySet } from "./models";

export const SEED_VERSION = library.seedVersion;
export const SEED_COUNT = library.records.length;

export function isExampleStudySet(id: string): boolean {
  return id === "sample-photosynthesis" || id.startsWith("seed-v1-");
}

export function seedStudySets(
  timestamp = new Date().toISOString(),
): StudySet[] {
  // Seed notes are authored classroom examples. They contain no AI output or fake activity.
  return library.records.map((record) =>
    studySetSchema.parse({
      ...record,
      createdAt: timestamp,
      updatedAt: timestamp,
      generation: null,
      cardReviews: {},
      attempts: [],
      quizDraft: null,
    }),
  );
}

export function mergeSeedStudySets(existing: StudySet[]): StudySet[] {
  const existingIds = new Set(existing.map((set) => set.id));
  const missing = seedStudySets().filter((set) => !existingIds.has(set.id));
  // User records always win, including edits to example notes or their progress.
  return [...existing, ...missing.slice(0, MAX_STUDY_SETS - existing.length)];
}
