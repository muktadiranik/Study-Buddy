import type { CardSchedule, StudySet } from "./models";
import { isOutdated } from "./study";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const REVIEW_DELAY_MS = 10 * 60 * 1000;
const INTERVALS = [1, 3, 7, 14, 30, 60, 120, 180, 365];

export function scheduleReview(
  previous: CardSchedule | undefined,
  rating: "got-it" | "review",
  now: number,
): CardSchedule {
  const reviewedAt = new Date(now).toISOString();
  if (rating === "review")
    return {
      dueAt: new Date(now + REVIEW_DELAY_MS).toISOString(),
      lastReviewedAt: reviewedAt,
      intervalDays: 0,
      repetitions: 0,
      lapses: Math.min((previous?.lapses ?? 0) + 1, 100_000),
    };
  // Early extra practice cannot advance several intervals in a single day.
  if (previous && previous.intervalDays > 0 && Date.parse(previous.dueAt) > now)
    return previous;
  const repetitions = Math.min((previous?.repetitions ?? 0) + 1, 100_000);
  const intervalDays =
    INTERVALS[Math.min(repetitions - 1, INTERVALS.length - 1)];
  return {
    dueAt: new Date(now + intervalDays * DAY_MS).toISOString(),
    lastReviewedAt: reviewedAt,
    intervalDays,
    repetitions,
    lapses: previous?.lapses ?? 0,
  };
}

export function dueCardIndices(set: StudySet, now = Date.now()): number[] {
  if (!set.generation || isOutdated(set)) return [];
  return set.generation.materials.flashcards.flatMap((_, index) => {
    const scheduled = set.cardSchedule[String(index)];
    return !scheduled || Date.parse(scheduled.dueAt) <= now ? [index] : [];
  });
}

export function nextReviewAt(set: StudySet): string | null {
  if (!set.generation || isOutdated(set)) return null;
  return (
    Object.values(set.cardSchedule)
      .map((schedule) => schedule.dueAt)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null
  );
}

export function reviewDateLabel(value: string, now = Date.now()): string {
  if (Date.parse(value) <= now) return "Due now";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
