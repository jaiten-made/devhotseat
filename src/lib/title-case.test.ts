import { describe, expect, it } from "vitest";
import { titleCase } from "./title-case";

describe("titleCase", () => {
  it("capitalises the ordinary words", () => {
    expect(titleCase("everything you said")).toBe("Everything You Said");
  });

  it("leaves the small joining words down", () => {
    expect(titleCase("the end of the interview")).toBe(
      "The End of the Interview",
    );
  });

  it("lifts a small word when it opens or closes the title", () => {
    expect(titleCase("of sessions and the answers to")).toBe(
      "Of Sessions and the Answers To",
    );
  });

  it("lifts the word that opens a subtitle", () => {
    expect(titleCase("sessions: the ones you finished")).toBe(
      "Sessions: The Ones You Finished",
    );
  });

  it("passes through words that are already capitalised", () => {
    expect(titleCase("your STAR answers with AI feedback")).toBe(
      "Your STAR Answers with AI Feedback",
    );
    expect(titleCase("iOS session")).toBe("iOS Session");
  });

  it("casts each side of a compound", () => {
    expect(titleCase("follow-up read/write")).toBe("Follow-up Read/Write");
  });

  it("keeps the spacing it was given", () => {
    expect(titleCase("  session   review  ")).toBe("  Session   Review  ");
  });

  it("survives punctuation and empty input", () => {
    expect(titleCase('"a note on scoring"')).toBe('"A Note on Scoring"');
    expect(titleCase("")).toBe("");
  });
});
