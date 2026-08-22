import { PILLARS } from "../../lib/report/rubric";
import promptTemplate from "./prompt.md?raw";

/** One completed question-and-answer pair from a finished session. */
export interface TranscriptTurn {
  /** The 1-based turn number, carried through so scores can be joined back. */
  readonly position: number;
  readonly questionText: string;
  readonly answerText: string;
}

const TRANSCRIPT_PLACEHOLDER = "{{transcript}}";
const RUBRIC_PLACEHOLDER = "{{rubric}}";

/**
 * The prompt template. It lives in its own .md file so the wording can be
 * iterated on without touching code; Vite inlines it as a string so there is
 * no filesystem read at runtime.
 */
export function loadPromptTemplate(): string {
  return promptTemplate;
}

/**
 * Renders the pillars and their weights from the rubric itself, so the prompt
 * and the score maths cannot drift apart.
 */
export function formatRubric(): string {
  return PILLARS.map(
    (pillar) =>
      `- ${pillar.label} (${pillar.weight}% of the score) — ${pillar.guidance}`,
  ).join("\n");
}

/**
 * Renders the transcript as numbered pairs. The number is the turn's position,
 * not its index, so `Q3.` in the prompt is turn 3 in the database — which is
 * what lets the parser check the scored positions against the ones sent.
 */
export function formatTranscript(turns: ReadonlyArray<TranscriptTurn>): string {
  return turns
    .map((turn) => {
      const answer = turn.answerText.trim();
      return [
        `Q${turn.position}. ${turn.questionText.trim()}`,
        `A${turn.position}. ${answer === "" ? "(left blank)" : answer}`,
      ].join("\n");
    })
    .join("\n\n");
}

/**
 * Builds the final prompt. Pure: the template is passed in rather than read,
 * so this is testable without touching the filesystem.
 */
export function buildPrompt(
  template: string,
  turns: ReadonlyArray<TranscriptTurn>,
): string {
  if (turns.length === 0) {
    throw new Error("Cannot build a report prompt from an empty transcript.");
  }
  for (const placeholder of [TRANSCRIPT_PLACEHOLDER, RUBRIC_PLACEHOLDER]) {
    if (!template.includes(placeholder)) {
      throw new Error(
        `Prompt template is missing the ${placeholder} placeholder.`,
      );
    }
  }
  return template
    .split(TRANSCRIPT_PLACEHOLDER)
    .join(formatTranscript(turns))
    .split(RUBRIC_PLACEHOLDER)
    .join(formatRubric());
}
