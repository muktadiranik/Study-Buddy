import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/materials.json";
import { generationSchema } from "./models";
import { sampleSet } from "./sample";
import {
  DAY_MS,
  REVIEW_DELAY_MS,
  dueCardIndices,
  nextReviewAt,
  scheduleReview,
} from "./repetition";

const NOW = Date.parse("2026-11-02T06:00:00.000Z");
function studySet() {
  const set = sampleSet();
  set.generation = generationSchema.parse({
    id: "g",
    notes: set.notes,
    createdAt: new Date(NOW).toISOString(),
    materials: fixture,
  });
  return set;
}

describe("spaced repetition", () => {
  it("treats unscheduled cards as due without inventing previous review dates", () => {
    const set = studySet();
    set.cardReviews = { "0": "got-it", "1": "review" };
    expect(dueCardIndices(set, NOW)).toEqual([0, 1]);
    expect(set.cardSchedule).toEqual({});
    expect(nextReviewAt(set)).toBeNull();
  });
  it("advances successful due reviews through increasing intervals", () => {
    let time = NOW;
    let previous;
    for (const days of [1, 3, 7, 14, 30, 60, 120, 180, 365, 365]) {
      const next = scheduleReview(previous, "got-it", time);
      expect(next.intervalDays).toBe(days);
      expect(Date.parse(next.dueAt)).toBe(time + days * DAY_MS);
      expect(next.lapses).toBe(0);
      time = Date.parse(next.dueAt);
      previous = next;
    }
  });
  it("does not advance a correct card again during early extra practice", () => {
    const previous = scheduleReview(undefined, "got-it", NOW);
    expect(scheduleReview(previous, "got-it", NOW + 60_000)).toEqual(previous);
  });
  it("resets a failed card to ten minutes and starts the interval ladder again", () => {
    const previous = scheduleReview(undefined, "got-it", NOW);
    const failed = scheduleReview(previous, "review", NOW + DAY_MS);
    expect(Date.parse(failed.dueAt)).toBe(NOW + DAY_MS + REVIEW_DELAY_MS);
    expect(failed.repetitions).toBe(0);
    expect(failed.lapses).toBe(1);
    const recovered = scheduleReview(
      failed,
      "got-it",
      Date.parse(failed.dueAt),
    );
    expect(recovered.intervalDays).toBe(1);
    expect(recovered.lapses).toBe(1);
  });
  it("selects due cards at the exact boundary and excludes future or outdated cards", () => {
    const set = studySet();
    set.cardSchedule = { "0": scheduleReview(undefined, "got-it", NOW) };
    expect(dueCardIndices(set, NOW + DAY_MS - 1)).toEqual([1]);
    expect(dueCardIndices(set, NOW + DAY_MS)).toEqual([0, 1]);
    expect(nextReviewAt(set)).toBe(new Date(NOW + DAY_MS).toISOString());
    set.notes += "\n\nEdited notes.";
    expect(dueCardIndices(set, NOW + DAY_MS)).toEqual([]);
    expect(nextReviewAt(set)).toBeNull();
  });
});
