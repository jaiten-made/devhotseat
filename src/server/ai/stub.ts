import type { ReportGenerator } from "./client";

/** Text the e2e specs assert on. */
export const STUB_REPORT_CONTENT =
  "This is a stubbed feedback report used by the end-to-end tests.";

/**
 * A report generator that never calls Gemini. Selected only when
 * HOTSEAT_STUB_REPORTS is set, which the Playwright web server does, so an
 * e2e run is deterministic, offline and free.
 */
export function createStubReportGenerator(): ReportGenerator {
  return {
    async generate() {
      return { content: STUB_REPORT_CONTENT, model: "stub-model" };
    },
  };
}
