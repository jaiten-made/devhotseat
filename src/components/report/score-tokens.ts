import type { Band } from "@/lib/report/score";

/**
 * Tailwind v4 extracts class names by scanning source text, so an interpolated
 * name like `bg-${band}` compiles to nothing. Every colour used by the report
 * has to be written out in full, which is what these maps are for.
 *
 * This is the one part of the app that is allowed to be colourful, and it is
 * the reason the rest is not. A score is a judgement, and a judgement is what
 * colour is reserved for here — so on a greyscale page these few marks are the
 * only thing competing for the eye, which is exactly where the eye should go.
 * See [27](../../../docs/adr/0027-greyscale-with-colour-reserved-for-judgements.md).
 *
 * A 3 lands on ink rather than a hue because "leaning hire" is solid rather
 * than good, and colouring it green would read as praise. It also means the
 * scale runs red, amber, ink, green — the middle of it is the page's own
 * colour, so only the ends of the scale raise their voice.
 */
export const SCORE_TEXT: Record<number, string> = {
  1: "text-destructive",
  2: "text-warning",
  3: "text-ink",
  4: "text-success",
};

export const SCORE_BG: Record<number, string> = {
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-ink",
  4: "bg-success",
};

export const BAND_TEXT: Record<Band, string> = {
  strong_no_hire: "text-destructive",
  leaning_no_hire: "text-warning",
  leaning_hire: "text-ink",
  strong_hire: "text-success",
};

/** Scores are read to one decimal: the scale has four points, not forty. */
export function formatScore(score: number): string {
  return score.toFixed(1);
}
