import type { StructuredReport } from "../../lib/report/schema";
import type { ReportGenerator } from "./client";
import type { TranscriptTurn } from "./prompt";

/** Text the e2e specs assert on. */
export const STUB_REPORT_CONTENT =
  "This is a stubbed feedback report used by the end-to-end tests.";

/**
 * Scores cycle by turn so the radar draws a lopsided shape rather than a
 * regular pentagon — a chart that would look identical however it was wired is
 * not worth asserting on.
 */
function stubTurn(turn: TranscriptTurn, index: number) {
  const score = (offset: number) => ((index + offset) % 4) + 1;
  const evidence = (pillar: string) =>
    `Stubbed ${pillar} evidence for question ${turn.position}.`;
  return {
    position: turn.position,
    situation: { score: score(0), evidence: evidence("situation") },
    task: { score: score(1), evidence: evidence("task") },
    action: { score: score(2), evidence: evidence("action") },
    result: { score: score(3), evidence: evidence("result") },
    learning: { score: score(1), evidence: evidence("learning") },
    strength: `Stubbed strength for question ${turn.position}.`,
    improvement: `Stubbed improvement for question ${turn.position}.`,
  };
}

/**
 * A report generator that never calls Gemini. Selected only when
 * HOTSEAT_STUB_REPORTS is set, which the Playwright web server does, so an
 * e2e run is deterministic, offline and free.
 */
export function createStubReportGenerator(): ReportGenerator {
  return {
    async generate(turns) {
      const structured: StructuredReport = {
        turns: turns.map(stubTurn),
        headline: "A stubbed headline for the end-to-end tests.",
        narrative: STUB_REPORT_CONTENT,
      };
      return {
        content: STUB_REPORT_CONTENT,
        structured,
        model: "stub-model",
      };
    },
  };
}
