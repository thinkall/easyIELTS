import type { ReadingTest } from "@/lib/content/types";
import { scoreObjective } from "@/lib/scoring/score";
import type { ObjectiveScore } from "@/lib/scoring/types";
import { gtReadingRawToBand } from "@/lib/ielts/bands";

export interface ReadingResult extends ObjectiveScore {
  /** Raw scaled to a 40-question equivalent (exact when total === 40). */
  scaledTo40: number;
  /** GT Reading band for the scaled score. */
  band: number;
  /** True when the test has fewer than 40 questions, so the band is an estimate. */
  bandIsEstimated: boolean;
}

export function scoreReadingTest(
  test: ReadingTest,
  answers: Record<string, string>,
): ReadingResult {
  const questions = test.sections.flatMap((section) => section.questions);
  const objective = scoreObjective(questions, answers);
  const scaledTo40 =
    objective.total === 0
      ? 0
      : objective.total === 40
        ? objective.raw
        : Math.round((objective.raw / objective.total) * 40);
  return {
    ...objective,
    scaledTo40,
    band: gtReadingRawToBand(scaledTo40),
    bandIsEstimated: objective.total !== 40,
  };
}
