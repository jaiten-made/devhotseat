import { z } from "zod";
import { MAX_SCORE, MIN_SCORE } from "./rubric";

/**
 * The contract for a scored report.
 *
 * This doubles as the JSON schema sent to Gemini, which constrains how it can
 * be written: `minLength`, `maxLength` and `pattern` are not in the supported
 * keyword list for `responseJsonSchema`, so no string here carries a length
 * bound. Lengths are trimmed after validation in `parse.ts` instead.
 */
const pillarAssessment = z.object({
  score: z
    .int()
    .min(MIN_SCORE)
    .max(MAX_SCORE)
    .describe(
      "1 strong no-hire, 2 leaning no-hire, 3 leaning hire, 4 strong hire",
    ),
  evidence: z
    .string()
    .describe(
      "One short sentence quoting or closely paraphrasing what was said.",
    ),
});

/**
 * Property order matters: the model generates keys in schema order, so the
 * scores and the per-answer notes are produced before the narrative that
 * summarises them.
 */
const turnAssessment = z.object({
  position: z
    .int()
    .min(1)
    .max(200)
    .describe("The number on the question, e.g. Q3 -> 3."),
  situation: pillarAssessment,
  task: pillarAssessment,
  action: pillarAssessment,
  result: pillarAssessment,
  learning: pillarAssessment,
  strength: z
    .string()
    .describe("The single strongest thing about this answer."),
  improvement: z
    .string()
    .describe("The single change that would most improve it."),
});

export const structuredReportSchema = z.object({
  turns: z.array(turnAssessment).min(1).max(50),
  headline: z
    .string()
    .describe("One sentence, under 15 words, summarising the session."),
  narrative: z
    .string()
    .describe(
      'A short coaching note addressed as "you", flowing prose, under 180 words.',
    ),
});

export type PillarAssessment = z.infer<typeof pillarAssessment>;
export type TurnAssessment = z.infer<typeof turnAssessment>;
export type StructuredReport = z.infer<typeof structuredReportSchema>;
