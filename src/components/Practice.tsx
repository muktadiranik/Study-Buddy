import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Layers,
  Lightbulb,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { Attempt, QuizDraft, StudySet } from "../lib/models";
import {
  dueCardIndices,
  nextReviewAt,
  reviewDateLabel,
  scheduleReview,
} from "../lib/repetition";
import {
  formatDate,
  isOutdated,
  masteredCount,
  missedIndices,
  reviewCardIndices,
  scoreQuiz,
} from "../lib/study";

export function Citations({
  sources,
  onSource,
}: {
  sources: number[];
  onSource: (n: number) => void;
}) {
  return (
    <span className="citations">
      {sources.map((n) => (
        <button
          key={n}
          onClick={() => onSource(n)}
          title={`Read note paragraph ${n}`}
          aria-label={`Read note paragraph ${n}`}
        >
          [{n}]
        </button>
      ))}
    </span>
  );
}

export function Flashcards({
  set,
  now,
  onUpdate,
  onSource,
}: {
  set: StudySet;
  now: number;
  onUpdate: (changes: Partial<StudySet>) => void;
  onSource: (n: number) => void;
}) {
  const cards = set.generation!.materials.flashcards;
  const review = reviewCardIndices(set);
  const due = dueCardIndices(set, now);
  const nextReview = nextReviewAt(set);
  const [queue, setQueue] = useState<number[] | null>(null);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  function start(indices: number[]) {
    setQueue(indices);
    setPosition(0);
    setRevealed(false);
  }
  function rate(rating: "got-it" | "review") {
    onUpdate({
      cardReviews: { ...set.cardReviews, [queue![position]]: rating },
      cardSchedule: {
        ...set.cardSchedule,
        [queue![position]]: scheduleReview(
          set.cardSchedule[String(queue![position])],
          rating,
          Date.now(),
        ),
      },
    });
    setPosition(position + 1);
    setRevealed(false);
  }
  if (!queue)
    return (
      <div className="practice-intro panel">
        <span className="round-icon lavender">
          <Layers size={25} />
        </span>
        <p className="eyebrow">A LITTLE REPETITION GOES A LONG WAY</p>
        <h2>Make the ideas stick.</h2>
        <p className="muted">
          Recall an answer before you reveal it. Be honest with yourself —
          <br className="desktop-break" /> every “Review again” is a step toward
          understanding.
        </p>
        <div className="practice-metrics">
          <div>
            <strong>{cards.length}</strong>
            <span>flashcards</span>
          </div>
          <div>
            <strong>{masteredCount(set)}</strong>
            <span>got it</span>
          </div>
          <div>
            <strong>{review.length}</strong>
            <span>to revisit</span>
          </div>
        </div>
        <div className="button-row centered">
          <button
            className="button primary"
            disabled={!due.length}
            onClick={() => start(due)}
          >
            Study due cards ({due.length}) <ArrowRight size={16} />
          </button>
          <button
            className="button secondary"
            onClick={() => start(cards.map((_, i) => i))}
          >
            Study all cards <ArrowRight size={16} />
          </button>
          <button
            className="button secondary"
            disabled={!review.length}
            onClick={() => start(review)}
          >
            <RotateCcw size={16} />
            Review again ({review.length})
          </button>
        </div>
        <p className="small muted repetition-note">
          New and overdue cards are due now.{" "}
          {due.length
            ? `${due.length} cards are ready.`
            : nextReview
              ? `Next review: ${reviewDateLabel(nextReview, now)}.`
              : "No review is scheduled yet."}{" "}
          Got it schedules longer intervals; Review again returns in 10 minutes.
        </p>
      </div>
    );
  if (position >= queue.length)
    return (
      <div className="practice-intro panel">
        <span className="round-icon sage">
          <CheckCircle2 size={28} />
        </span>
        <p className="eyebrow">SESSION COMPLETE</p>
        <h2>A little more confident.</h2>
        <p className="small muted">
          {due.length} cards due now
          {nextReview
            ? ` · Next review: ${reviewDateLabel(nextReview, now)}`
            : ""}
        </p>
        <p className="muted">
          You worked through {queue.length}{" "}
          {queue.length === 1 ? "card" : "cards"}.{" "}
          {review.length
            ? `${review.length} still need a little practice.`
            : "No cards are currently marked for review."}
        </p>
        <div className="button-row centered">
          <button
            className="button primary"
            disabled={!review.length}
            onClick={() => start(review)}
          >
            <RotateCcw size={16} />
            Revisit review cards ({review.length})
          </button>
          <button className="button secondary" onClick={() => setQueue(null)}>
            Back to flashcards
          </button>
        </div>
      </div>
    );
  const card = cards[queue[position]];
  return (
    <div className="panel flash-session">
      <div className="section-heading">
        <button className="text-button" onClick={() => setQueue(null)}>
          <ChevronLeft size={16} /> End session
        </button>
        <span className="small muted">
          Card {position + 1} of {queue.length}
        </span>
      </div>
      <div className="track">
        <div style={{ width: `${(position / queue.length) * 100}%` }} />
      </div>
      <div className={`flashcard ${revealed ? "revealed" : ""}`}>
        <span className="eyebrow">
          {revealed ? "THE ANSWER" : "THINK IT THROUGH"}
        </span>
        <h2>{card.question}</h2>
        {revealed ? (
          <div className="flash-answer" aria-live="polite">
            <p>{card.answer}</p>
            <Citations sources={card.sources} onSource={onSource} />
          </div>
        ) : (
          <p className="muted">Take a moment. What comes to mind?</p>
        )}
      </div>
      <div className="button-row centered">
        {revealed ? (
          <>
            <button className="button secondary" onClick={() => rate("review")}>
              <RotateCcw size={17} />
              Review again
            </button>
            <button className="button primary" onClick={() => rate("got-it")}>
              <Check size={18} />
              Got it
            </button>
          </>
        ) : (
          <button className="button primary" onClick={() => setRevealed(true)}>
            Reveal answer <ArrowRight size={17} />
          </button>
        )}
      </div>
      <p className="small muted text-center">
        Your ratings and review dates are saved as you go.{" "}
        {revealed &&
          `Got it: ${reviewDateLabel(scheduleReview(set.cardSchedule[String(queue[position])], "got-it", now).dueAt, now)} · Review again: in 10 minutes.`}
      </p>
    </div>
  );
}

export function Quiz({
  set,
  onUpdate,
  onSource,
}: {
  set: StudySet;
  onUpdate: (changes: Partial<StudySet>) => void;
  onSource: (n: number) => void;
}) {
  const all = set.generation!.materials.quiz;
  const [result, setResult] = useState<Attempt | null>(null);
  const draft = set.quizDraft;
  const latest = [...set.attempts]
    .reverse()
    .find((a) => a.generationId === set.generation!.id);
  function start(
    indices = all.map((_, i) => i),
    kind: QuizDraft["kind"] = "full",
  ) {
    setResult(null);
    onUpdate({
      quizDraft: {
        generationId: set.generation!.id,
        kind,
        indices,
        answers: indices.map(() => null),
      },
    });
  }
  function retry(attempt: Attempt) {
    const missed = missedIndices(attempt)
      .map((i) =>
        all.findIndex((q) => q.question === attempt.questions[i].question),
      )
      .filter((i) => i !== -1);
    if (missed.length) start(missed, "retry");
  }
  function submit() {
    if (!draft || draft.answers.some((a) => a === null)) return;
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      generationId: draft.generationId,
      createdAt: new Date().toISOString(),
      kind: draft.kind,
      questions: draft.indices.map((i) => all[i]),
      answers: draft.answers as number[],
    };
    onUpdate({
      attempts: [...set.attempts, attempt].slice(-100),
      quizDraft: null,
    });
    setResult(attempt);
  }
  if (result) {
    const score = scoreQuiz(result.questions, result.answers);
    return (
      <div className="quiz-results">
        <div className="panel result-header">
          <div className="score-circle">
            {score.percent}
            <span>%</span>
          </div>
          <div>
            <p className="eyebrow">
              {result.kind === "retry" ? "RETRY COMPLETE" : "QUIZ COMPLETE"}
            </p>
            <h2>
              {score.correct === score.total
                ? "Look at you, making connections."
                : "Every mistake is a place to grow."}
            </h2>
            <p className="muted">
              {score.correct} of {score.total} correct. Your score is saved in
              Progress.
            </p>
          </div>
        </div>
        {result.questions.map((q, i) => {
          const correct = result.answers[i] === q.correct_index;
          return (
            <article className="panel question-result" key={i}>
              <span
                className={`result-label ${correct ? "correct" : "incorrect"}`}
              >
                {correct ? <CheckCircle2 size={16} /> : <RotateCcw size={16} />}
                {correct ? "Got it right" : "Worth another look"} · Question{" "}
                {i + 1}
              </span>
              <h3>{q.question}</h3>
              <p className={correct ? "muted" : "wrong-answer"}>
                Your answer: {q.options[result.answers[i]]}
              </p>
              {!correct && (
                <p className="correct-answer">
                  Correct answer: {q.options[q.correct_index]}
                </p>
              )}
              <p className="explanation">
                {q.explanation}{" "}
                <Citations sources={q.sources} onSource={onSource} />
              </p>
              {!correct && (
                <div className="example">
                  <Lightbulb size={19} />
                  <div>
                    <strong>Illustrative example — not from your notes</strong>
                    <p>{q.simpler_example}</p>
                  </div>
                </div>
              )}
            </article>
          );
        })}
        <div className="button-row">
          <button
            className="button primary"
            disabled={!missedIndices(result).length}
            onClick={() => retry(result)}
          >
            <RotateCcw size={16} />
            Retry missed questions ({missedIndices(result).length})
          </button>
          <button className="button secondary" onClick={() => start()}>
            Take full quiz again
          </button>
        </div>
      </div>
    );
  }
  if (!draft)
    return (
      <div className="practice-intro panel">
        <span className="round-icon peach">
          <Sparkles size={25} />
        </span>
        <p className="eyebrow">GET CURIOUS. TEST YOURSELF.</p>
        <h2>See what you really understand.</h2>
        <p className="muted">
          {all.length} questions, no timer, no pressure. Choose your answers,
          <br className="desktop-break" /> then check the explanations and learn
          from your mistakes.
        </p>
        <div className="practice-metrics">
          <div>
            <strong>{all.length}</strong>
            <span>questions</span>
          </div>
          <div>
            <strong>4</strong>
            <span>options each</span>
          </div>
          <div>
            <strong>
              {latest
                ? `${scoreQuiz(latest.questions, latest.answers).percent}%`
                : "—"}
            </strong>
            <span>last score{latest?.kind === "retry" ? " (retry)" : ""}</span>
          </div>
        </div>
        <div className="button-row centered">
          <button className="button primary" onClick={() => start()}>
            Start practice quiz <ArrowRight size={17} />
          </button>
          {latest && missedIndices(latest).length > 0 && (
            <button className="button secondary" onClick={() => retry(latest)}>
              <RotateCcw size={16} />
              Retry last mistakes
            </button>
          )}
        </div>
      </div>
    );
  const answered = draft.answers.filter((a) => a !== null).length;
  return (
    <div className="quiz-questions">
      <div className="section-heading">
        <div>
          <h2>
            {draft.kind === "retry"
              ? "Another look at your mistakes"
              : "A little check-in with your knowledge"}
          </h2>
          <p className="small muted">
            Answers stay hidden until you submit. Your choices are saved as you
            go.
          </p>
        </div>
        <span className="count-badge">
          {answered} / {draft.indices.length}
        </span>
      </div>
      {draft.indices.map((index, n) => {
        const q = all[index];
        return (
          <fieldset className="panel question" key={index}>
            <legend>
              <span className="eyebrow">QUESTION {n + 1}</span>
              <span className="question-title">{q.question}</span>
            </legend>
            <div className="options">
              {q.options.map((option, o) => (
                <label
                  className={`option ${draft.answers[n] === o ? "selected" : ""}`}
                  key={o}
                >
                  <input
                    type="radio"
                    name={`question-${n}`}
                    value={o}
                    checked={draft.answers[n] === o}
                    onChange={() =>
                      onUpdate({
                        quizDraft: {
                          ...draft,
                          answers: draft.answers.map((v, i) =>
                            i === n ? o : v,
                          ),
                        },
                      })
                    }
                  />
                  <span className="option-letter">{"ABCD"[o]}</span>
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
      <div className="quiz-footer">
        <span className="small muted">
          {answered === draft.indices.length
            ? "Ready when you are."
            : "Answer every question to check your results."}
        </span>
        <button
          className="button primary"
          disabled={answered !== draft.indices.length}
          onClick={submit}
        >
          Check my answers <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

export function Progress({
  set,
  now,
  onReview,
  onQuiz,
}: {
  set: StudySet;
  now: number;
  onReview: () => void;
  onQuiz: () => void;
}) {
  const mastered = masteredCount(set),
    review = reviewCardIndices(set);
  const total = isOutdated(set)
    ? 0
    : (set.generation?.materials.flashcards.length ?? 0);
  const attempts = [...set.attempts].reverse();
  const fullAttempts = attempts.filter((a) => a.kind === "full");
  const latest = fullAttempts[0];
  const due = dueCardIndices(set, now);
  const nextReview = nextReviewAt(set);
  return (
    <div className="progress-content">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SMALL STEPS, REAL PROGRESS</p>
          <h2>Your effort adds up.</h2>
        </div>
        <span className="small muted">Calculated from your activity</span>
      </div>
      <div className="progress-stats">
        <div className="panel">
          <span className="muted small">Cards you know</span>
          <strong>
            {mastered}
            <small> / {total}</small>
          </strong>
          <div className="track">
            <div
              style={{ width: `${total ? (mastered / total) * 100 : 0}%` }}
            />
          </div>
          <p className="small muted">
            {total
              ? `${Math.round((mastered / total) * 100)}% marked “Got it”`
              : "Generate materials to get started"}
          </p>
        </div>
        <div className="panel">
          <span className="muted small">Latest full quiz</span>
          <strong>
            {latest
              ? `${scoreQuiz(latest.questions, latest.answers).percent}%`
              : "—"}
          </strong>
          <p className="small muted">
            {latest
              ? `${formatDate(latest.createdAt)}${latest.generationId !== set.generation?.id || isOutdated(set) ? " · earlier notes" : ""}`
              : "Your first score starts here"}
          </p>
        </div>
        <div className="panel">
          <span className="muted small">Practice completed</span>
          <strong>{attempts.length}</strong>
          <p className="small muted">
            {fullAttempts.length} full{" "}
            {fullAttempts.length === 1 ? "quiz" : "quizzes"} ·{" "}
            {attempts.length - fullAttempts.length}{" "}
            {attempts.length - fullAttempts.length === 1 ? "retry" : "retries"}
          </p>
        </div>
      </div>
      <div className="progress-columns">
        <div className="panel history">
          <h3>
            Quiz history <span className="count-badge">{attempts.length}</span>
          </h3>
          {attempts.length ? (
            <div className="history-list">
              {attempts.map((a, i) => {
                const score = scoreQuiz(a.questions, a.answers);
                return (
                  <div className="history-row" key={a.id}>
                    <span className="history-icon">
                      <CheckCircle2 size={18} />
                    </span>
                    <div>
                      <strong>
                        {a.kind === "full"
                          ? "Practice quiz"
                          : "Missed-question retry"}
                        {i === 0 && <span className="tiny-badge">Latest</span>}
                      </strong>
                      <span className="small muted">
                        {new Date(a.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        · {score.correct}/{score.total} correct
                        {a.generationId !== set.generation?.id ||
                        isOutdated(set)
                          ? " · earlier notes"
                          : ""}
                      </span>
                    </div>
                    <span
                      className={`score-badge ${score.percent >= 80 ? "good" : ""}`}
                    >
                      {score.percent}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mini-empty">
              <Sparkles size={24} />
              <h4>A fresh start.</h4>
              <p className="muted small">
                Finish a quiz to see your first result here.
              </p>
              <button className="text-button" onClick={onQuiz}>
                Go to Quiz <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
        <div className="panel review-panel">
          <span className="round-icon lavender">
            <RotateCcw size={22} />
          </span>
          <h3>{due.length} cards due for review</h3>
          <p className="small muted">
            Includes new and overdue cards.{" "}
            {nextReview
              ? `Next scheduled review: ${reviewDateLabel(nextReview, now)}.`
              : "Rating a card starts its schedule."}
          </p>
          <p className="muted">
            {review.length
              ? `${review.length} flashcards are waiting for a little more attention.`
              : "Cards marked “Review again” will appear here. A little practice goes a long way."}
          </p>
          <button className="button secondary" onClick={onReview}>
            Go to Flashcards <ArrowRight size={16} />
          </button>
          {!isOutdated(set) && (
            <ul className="review-schedule">
              {Object.entries(set.cardSchedule)
                .sort((a, b) => Date.parse(a[1].dueAt) - Date.parse(b[1].dueAt))
                .slice(0, 3)
                .map(([index, schedule]) => (
                  <li key={index}>
                    Card {Number(index) + 1}
                    <span>{reviewDateLabel(schedule.dueAt, now)}</span>
                  </li>
                ))}
            </ul>
          )}
          <p className="small muted">
            {total - mastered - review.length > 0
              ? `${total - mastered - review.length} cards haven’t been rated yet.`
              : "Learn at your own pace."}
          </p>
        </div>
      </div>
      <p className="small muted">
        History keeps your most recent 100 attempts per set. Retrying mistakes
        is recorded separately from a full quiz.
      </p>
    </div>
  );
}
