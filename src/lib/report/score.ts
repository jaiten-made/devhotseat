import { MAX_SCORE, MIN_SCORE, PILLARS, WEIGHT_TOTAL } from "./rubric";
import type { TurnAssessment } from "./schema";

/** The five pillar scores for one answer, without the evidence. */
export type PillarScores = Record<(typeof PILLARS)[number]["id"], number>;

export type Band =
  | "strong_no_hire"
  | "leaning_no_hire"
  | "leaning_hire"
  | "strong_hire";

/** Strips the evidence off an assessment, leaving just the numbers. */
export function scoresOf(turn: TurnAssessment): PillarScores {
  return {
    situation: turn.situation.score,
    task: turn.task.score,
    action: turn.action.score,
    result: turn.result.score,
    learning: turn.learning.score,
  };
}

/**
 * One answer's weighted score, in [1, 4]. The weighting is what makes Action
 * dominate: a strong story badly summarised still scores well, a well-framed
 * story with no execution in it does not.
 */
export function turnScore(scores: PillarScores): number {
  const weighted = PILLARS.reduce(
    (total, pillar) => total + pillar.weight * scores[pillar.id],
    0,
  );
  return weighted / WEIGHT_TOTAL;
}

/**
 * The session roll-up: the unweighted mean of the per-turn weighted scores.
 * Every question counts equally — the weighting is *within* an answer, not
 * across answers, so a long session cannot dilute one bad story.
 */
export function sessionScore(turns: ReadonlyArray<PillarScores>): number {
  if (turns.length === 0) {
    throw new Error("Cannot score a session with no assessed turns.");
  }
  const total = turns.reduce((sum, scores) => sum + turnScore(scores), 0);
  return total / turns.length;
}

/** Each pillar averaged across every answer, for the radar and the bars. */
export function pillarAverages(
  turns: ReadonlyArray<PillarScores>,
): PillarScores {
  if (turns.length === 0) {
    throw new Error("Cannot average pillars with no assessed turns.");
  }
  const averages = {} as PillarScores;
  for (const pillar of PILLARS) {
    const total = turns.reduce((sum, scores) => sum + scores[pillar.id], 0);
    averages[pillar.id] = total / turns.length;
  }
  return averages;
}

/**
 * Maps a [1, 4] score onto [0, 100] for a meter or bar width. A 1 is an empty
 * bar rather than a quarter-full one: the scale starts at 1, so 1 is the floor.
 */
export function asPercent(score: number): number {
  const clamped = Math.min(Math.max(score, MIN_SCORE), MAX_SCORE);
  return ((clamped - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) * 100;
}

/**
 * Splits [1, 4] into four equal quarters, lower-inclusive. Always call this
 * with the unrounded score: rounding first would move a 3.24 into the band
 * above.
 */
export function band(score: number): Band {
  if (score < 1.75) return "strong_no_hire";
  if (score < 2.5) return "leaning_no_hire";
  if (score < 3.25) return "leaning_hire";
  return "strong_hire";
}

export function bandLabel(value: Band): string {
  switch (value) {
    case "strong_no_hire":
      return "Strong no-hire";
    case "leaning_no_hire":
      return "Leaning no-hire";
    case "leaning_hire":
      return "Leaning hire";
    case "strong_hire":
      return "Strong hire";
  }
}
