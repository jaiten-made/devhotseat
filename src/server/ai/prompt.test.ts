import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  formatTranscript,
  loadPromptTemplate,
  type TranscriptTurn,
} from "./prompt";

const turns: ReadonlyArray<TranscriptTurn> = [
  {
    questionText: "Why did you leave your last role?",
    answerText: "Team dissolved.",
  },
  {
    questionText: "Describe a hard bug.",
    answerText: "A race in the retry loop.",
  },
];

describe("formatTranscript", () => {
  it("numbers each pair and keeps them in order", () => {
    expect(formatTranscript(turns)).toBe(
      [
        "Q1. Why did you leave your last role?",
        "A1. Team dissolved.",
        "",
        "Q2. Describe a hard bug.",
        "A2. A race in the retry loop.",
      ].join("\n"),
    );
  });

  it("marks a blank answer instead of leaving an empty line", () => {
    const output = formatTranscript([
      { questionText: "Tell me about yourself.", answerText: "   " },
    ]);
    expect(output).toBe("Q1. Tell me about yourself.\nA1. (left blank)");
  });

  it("keeps line breaks inside a multi-line answer", () => {
    const output = formatTranscript([
      {
        questionText: "Walk me through it.",
        answerText: "First this.\nThen that.",
      },
    ]);
    expect(output).toContain("A1. First this.\nThen that.");
  });

  it("trims surrounding whitespace from both sides of a pair", () => {
    const output = formatTranscript([
      {
        questionText: "  Padded question?  ",
        answerText: "\n Padded answer \n",
      },
    ]);
    expect(output).toBe("Q1. Padded question?\nA1. Padded answer");
  });
});

describe("buildPrompt", () => {
  const template = "PREAMBLE\n\n{{transcript}}\n\nINSTRUCTIONS";

  it("substitutes the transcript into the placeholder", () => {
    const prompt = buildPrompt(template, turns);
    expect(prompt).toBe(
      `PREAMBLE\n\n${formatTranscript(turns)}\n\nINSTRUCTIONS`,
    );
  });

  it("leaves no placeholder behind", () => {
    expect(buildPrompt(template, turns)).not.toContain("{{transcript}}");
  });

  it("includes every question and answer", () => {
    const prompt = buildPrompt(template, turns);
    for (const turn of turns) {
      expect(prompt).toContain(turn.questionText);
      expect(prompt).toContain(turn.answerText);
    }
  });

  it("replaces every occurrence when the template repeats the placeholder", () => {
    const prompt = buildPrompt("{{transcript}} then {{transcript}}", [
      { questionText: "Only question?", answerText: "Only answer." },
    ]);
    expect(prompt).not.toContain("{{transcript}}");
    expect(prompt.match(/Q1\./g)).toHaveLength(2);
  });

  it("refuses an empty transcript", () => {
    expect(() => buildPrompt(template, [])).toThrow(/empty transcript/i);
  });

  it("refuses a template with no placeholder", () => {
    expect(() => buildPrompt("no slot here", turns)).toThrow(/placeholder/i);
  });
});

describe("the shipped prompt.md", () => {
  // Reads a file colocated with the source, not a database or a network call.
  // Guards against editing the prompt and silently breaking substitution.
  it("contains the placeholder buildPrompt substitutes", () => {
    expect(loadPromptTemplate()).toContain("{{transcript}}");
  });

  it("renders into a prompt carrying both the instructions and the answers", () => {
    const prompt = buildPrompt(loadPromptTemplate(), turns);
    expect(prompt).toContain("feedback report");
    expect(prompt).toContain("A race in the retry loop.");
    expect(prompt).not.toContain("{{transcript}}");
  });
});
