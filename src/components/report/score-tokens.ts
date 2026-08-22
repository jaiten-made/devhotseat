import type { Band } from "@/lib/report/score";

/**
 * Tailwind v4 extracts class names by scanning source text, so an interpolated
 * name like `bg-${band}` compiles to nothing. Every colour used by the report
 * has to be written out in full, which is what these maps are for.
 *
 * A 3 lands on `primary` — near-black in this neutral palette — because
 * "leaning hire" is solid rather than good, and colouring it green would read
 * as praise.
 */
export const SCORE_TEXT: Record<number, string> = {
  1: "text-destructive",
  2: "text-warning",
  3: "text-foreground",
  4: "text-success",
};

export const SCORE_BG: Record<number, string> = {
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-primary",
  4: "bg-success",
};

/** Tinted chip backgrounds, light enough to keep the score readable on top. */
export const SCORE_CHIP: Record<number, string> = {
  1: "bg-destructive/10 text-destructive",
  2: "bg-warning/10 text-warning",
  3: "bg-secondary text-secondary-foreground",
  4: "bg-success/10 text-success",
};

export const BAND_TEXT: Record<Band, string> = {
  strong_no_hire: "text-destructive",
  leaning_no_hire: "text-warning",
  leaning_hire: "text-foreground",
  strong_hire: "text-success",
};

export const BAND_BG: Record<Band, string> = {
  strong_no_hire: "bg-destructive",
  leaning_no_hire: "bg-warning",
  leaning_hire: "bg-primary",
  strong_hire: "bg-success",
};

/** Scores are read to one decimal: the scale has four points, not forty. */
export function formatScore(score: number): string {
  return score.toFixed(1);
}
