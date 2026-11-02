import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/materials.json";
import { generationSchema, type Attempt, type StudySet } from "./models";
import { sampleSet } from "./sample";
import {
  isOutdated,
  masteredCount,
  missedIndices,
  reviewCardIndices,
  scoreQuiz,
} from "./study";

export function practicedSet(): StudySet {
  const set = sampleSet();
  set.generation = generationSchema.parse({
    id: "generation-1",
    notes: set.notes,
    createdAt: set.createdAt,
    materials: fixture,
  });
  return set;
}

describe("quiz scoring", () => {
  const questions = practicedSet().generation!.materials.quiz;
  it("scores actual correct answers and reports wrong and unanswered answers", () => {
    expect(scoreQuiz(questions, [0, 1])).toEqual({
      correct: 2,
      total: 2,
      percent: 100,
    });
    expect(scoreQuiz(questions, [3, 1])).toEqual({
      correct: 1,
      total: 2,
      percent: 50,
    });
    expect(scoreQuiz(questions, [null, 2]).percent).toBe(0);
    expect(scoreQuiz([], []).percent).toBe(0);
  });
  it("selects only the missed questions for retry", () => {
    const attempt: Attempt = {
      id: "a",
      generationId: "g",
      createdAt: "",
      kind: "full",
      questions,
      answers: [3, 1],
    };
    expect(missedIndices(attempt)).toEqual([0]);
    expect(missedIndices({ ...attempt, answers: [0, 1] })).toEqual([]);
  });
});

describe("flashcard review", () => {
  it("revisits only cards explicitly marked for review and reflects rating changes", () => {
    const set = practicedSet();
    expect(reviewCardIndices(set)).toEqual([]);
    set.cardReviews = { "0": "review", "1": "got-it", "99": "review" };
    expect(reviewCardIndices(set)).toEqual([0]);
    expect(masteredCount(set)).toBe(1);
    set.cardReviews["0"] = "got-it";
    expect(reviewCardIndices(set)).toEqual([]);
    expect(masteredCount(set)).toBe(2);
  });
  it("does not count outdated materials as current progress", () => {
    const set = practicedSet();
    set.cardReviews = { "0": "review", "1": "got-it" };
    set.notes += "\n\nNew information.";
    expect(isOutdated(set)).toBe(true);
    expect(reviewCardIndices(set)).toEqual([]);
    expect(masteredCount(set)).toBe(0);
  });
});
