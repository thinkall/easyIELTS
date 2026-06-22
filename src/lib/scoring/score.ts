import type { Question, ObjectiveScore, QuestionResult } from "./types";
import { normalizeAnswer, exceedsWordLimit } from "./normalize";

/**
 * Auto-score objective questions (Listening / Reading). Each question is one
 * mark by default. An answer is correct when, after normalization, it matches
 * any accepted variant and does not exceed the question's word limit.
 */
export function scoreObjective(
  questions: Question[],
  answers: Record<string, string>,
): ObjectiveScore {
  const results: QuestionResult[] = questions.map((question) => {
    const points = question.points ?? 1;
    const given = answers[question.id] ?? "";
    const normalizedGiven = normalizeAnswer(given);
    const overLimit = exceedsWordLimit(given, question.wordLimit);
    const correct =
      !overLimit &&
      normalizedGiven !== "" &&
      question.accepted.some((variant) => normalizeAnswer(variant) === normalizedGiven);

    return {
      id: question.id,
      correct,
      given,
      accepted: question.accepted,
      points,
      earned: correct ? points : 0,
    };
  });

  const raw = results.reduce((sum, result) => sum + result.earned, 0);
  const total = results.reduce((sum, result) => sum + result.points, 0);
  return { raw, total, results };
}
