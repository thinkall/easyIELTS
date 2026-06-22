import type { ListeningTest } from "@/lib/content/types";
import { scoreObjective } from "@/lib/scoring/score";
import type { ObjectiveScore } from "@/lib/scoring/types";
import { listeningRawToBand } from "@/lib/ielts/bands";

export interface ListeningResult extends ObjectiveScore {
  scaledTo40: number;
  band: number;
  bandIsEstimated: boolean;
}

export function scoreListeningTest(
  test: ListeningTest,
  answers: Record<string, string>,
): ListeningResult {
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
    band: listeningRawToBand(scaledTo40),
    bandIsEstimated: objective.total !== 40,
  };
}
