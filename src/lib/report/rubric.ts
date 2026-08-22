/**
 * STAR-L: the five pillars a behavioural answer is scored on, and what each is
 * worth in the final score.
 *
 * This array is the single source of truth. The prompt renders its labels and
 * weights, the radar draws one axis per entry, and the bars list them in this
 * order — so the order is load-bearing and pinned by a test.
 */
export const PILLARS = [
  {
    id: "situation",
    label: "Situation",
    weight: 12,
    guidance: "context, constraints, timeline and stakes, set without rambling",
  },
  {
    id: "task",
    label: "Task",
    weight: 8,
    guidance:
      "a clear problem definition, the candidate's specific remit, the core challenge",
  },
  {
    id: "action",
    label: "Action",
    weight: 55,
    guidance:
      'concrete step-by-step personal execution ("I", not "we"), technical and process trade-offs, obstacles overcome',
  },
  {
    id: "result",
    label: "Result",
    weight: 17,
    guidance: "a concrete, measurable outcome tied back to the situation",
  },
  {
    id: "learning",
    label: "Learning",
    weight: 8,
    guidance: "self-awareness, lessons drawn, what they would do differently",
  },
] as const;

/** One of the five pillar keys, used as the property name everywhere. */
export type PillarId = (typeof PILLARS)[number]["id"];

/** The weights are percentages and must add up to this. */
export const WEIGHT_TOTAL = 100;

/** The lowest and highest score any single pillar can take. */
export const MIN_SCORE = 1;
export const MAX_SCORE = 4;
