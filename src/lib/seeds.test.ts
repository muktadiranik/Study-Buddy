import { describe, expect, it } from "vitest";
import { paragraphs, studySetSchema } from "./models";
import {
  isExampleStudySet,
  mergeSeedStudySets,
  seedStudySets,
  SEED_COUNT,
} from "./seeds";
import { sampleSet } from "./sample";

describe("the classroom example library", () => {
  it("contains 520 distinct, valid, substantial study sets across eight subjects", () => {
    const sets = seedStudySets("2026-11-01T00:00:00.000Z");
    expect(SEED_COUNT).toBe(520);
    expect(sets).toHaveLength(520);
    expect(new Set(sets.map((s) => s.id)).size).toBe(520);
    expect(new Set(sets.map((s) => s.title)).size).toBe(520);
    expect(new Set(sets.map((s) => s.notes)).size).toBe(520);
    expect(new Set(sets.map((s) => s.subject)).size).toBe(8);
    for (const set of sets) {
      expect(studySetSchema.safeParse(set).success).toBe(true);
      expect(paragraphs(set.notes)).toHaveLength(4);
      expect(set.notes.length).toBeGreaterThan(300);
      expect(isExampleStudySet(set.id)).toBe(true);
      expect(set.generation).toBeNull();
      expect(set.attempts).toEqual([]);
      expect(set.cardReviews).toEqual({});
      expect(set.quizDraft).toBeNull();
    }
    // About 1 MiB as UTF-16; leave substantial space for the student's own work.
    expect(JSON.stringify(sets).length * 2).toBeLessThan(1_500_000);
  });
  it("merges idempotently and preserves edited examples and their progress", () => {
    const edited = seedStudySets()[0];
    edited.title = "My edited algebra lesson";
    edited.notes += "\n\nMy own reminder.";
    const existing = [sampleSet(), edited];
    const merged = mergeSeedStudySets(existing);
    expect(merged).toHaveLength(521);
    expect(merged[1]).toEqual(edited);
    expect(mergeSeedStudySets(merged)).toEqual(merged);
  });
});
