import { describe, expect, it } from "vitest";
import { parseReportResponse } from "./parse";

describe("parseReportResponse", () => {
  it("returns the report text", () => {
    expect(parseReportResponse({ text: "You answer concretely." })).toBe(
      "You answer concretely.",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(parseReportResponse({ text: "\n  Solid answers.  \n" })).toBe(
      "Solid answers.",
    );
  });

  it("keeps paragraph breaks inside the report", () => {
    expect(parseReportResponse({ text: "One.\n\nTwo." })).toBe("One.\n\nTwo.");
  });

  it("throws when there is no text at all", () => {
    expect(() => parseReportResponse({})).toThrow(/no report text/i);
  });

  it("throws when the text is only whitespace", () => {
    expect(() => parseReportResponse({ text: "   \n " })).toThrow(
      /no report text/i,
    );
  });

  it("names the finish reason when the model was cut off", () => {
    expect(() =>
      parseReportResponse({
        text: "",
        candidates: [{ finishReason: "SAFETY" }],
      }),
    ).toThrow(/finishReason: SAFETY/);
  });

  it("names MAX_TOKENS when nothing came back within the limit", () => {
    expect(() =>
      parseReportResponse({ candidates: [{ finishReason: "MAX_TOKENS" }] }),
    ).toThrow(/finishReason: MAX_TOKENS/);
  });

  // A truncated report is still a usable report; only emptiness is a failure.
  it("accepts text even when the model stopped at the token limit", () => {
    expect(
      parseReportResponse({
        text: "You start strongly but the third answer",
        candidates: [{ finishReason: "MAX_TOKENS" }],
      }),
    ).toBe("You start strongly but the third answer");
  });
});
