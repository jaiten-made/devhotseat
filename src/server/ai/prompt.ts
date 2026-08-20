import promptTemplate from "./prompt.md?raw";

/** One completed question-and-answer pair from a finished session. */
export interface TranscriptTurn {
  readonly questionText: string;
  readonly answerText: string;
}

const PLACEHOLDER = "{{transcript}}";

/**
 * The prompt template. It lives in its own .md file so the wording can be
 * iterated on without touching code; Vite inlines it as a string so there is
 * no filesystem read at runtime.
 */
export function loadPromptTemplate(): string {
  return promptTemplate;
}

/**
 * Renders the transcript as numbered pairs. Numbering lets the report refer to
 * a specific answer without having to quote it in full.
 */
export function formatTranscript(turns: ReadonlyArray<TranscriptTurn>): string {
  return turns
    .map((turn, index) => {
      const number = index + 1;
      const answer = turn.answerText.trim();
      return [
        `Q${number}. ${turn.questionText.trim()}`,
        `A${number}. ${answer === "" ? "(left blank)" : answer}`,
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
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(
      `Prompt template is missing the ${PLACEHOLDER} placeholder.`,
    );
  }
  return template.split(PLACEHOLDER).join(formatTranscript(turns));
}
