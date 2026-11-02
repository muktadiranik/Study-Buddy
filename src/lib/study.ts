import type { Attempt, Question, StudySet } from "./models";

// Calculate scores from answers, never from a stored or AI-provided score.
export function scoreQuiz(questions: Question[], answers: (number | null)[]) {
  const correct = questions.filter(
    (q, i) => answers[i] === q.correct_index,
  ).length;
  return {
    correct,
    total: questions.length,
    percent: questions.length
      ? Math.round((correct / questions.length) * 100)
      : 0,
  };
}

export function missedIndices(attempt: Attempt): number[] {
  return attempt.questions.flatMap((q, i) =>
    attempt.answers[i] === q.correct_index ? [] : [i],
  );
}

export function isOutdated(set: StudySet): boolean {
  return !!set.generation && set.generation.notes !== set.notes;
}

export function reviewCardIndices(set: StudySet): number[] {
  if (!set.generation || isOutdated(set)) return [];
  return set.generation.materials.flashcards.flatMap((_, i) =>
    set.cardReviews[String(i)] === "review" ? [i] : [],
  );
}

export function masteredCount(set: StudySet): number {
  if (!set.generation || isOutdated(set)) return 0;
  return set.generation.materials.flashcards.filter(
    (_, i) => set.cardReviews[String(i)] === "got-it",
  ).length;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
