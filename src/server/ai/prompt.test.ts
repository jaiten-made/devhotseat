import { describe, expect, it } from "vitest";
import { PILLARS } from "../../lib/report/rubric";
import {
  buildPrompt,
  formatRubric,
  formatTranscript,
  loadPromptTemplate,
  type TranscriptTurn,
} from "./prompt";

const turns: ReadonlyArray<TranscriptTurn> = [
  {
    position: 1,
    questionText: "Why did you leave your last role?",
    answerText: "Team dissolved.",
  },
  {
    position: 2,
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

  // The position is the database's turn number, not the array index. A session
  // ended early can hand over a gap, and the numbering has to survive it.
  it("numbers from the position, not the index", () => {
    const output = formatTranscript([
      { position: 4, questionText: "Fourth?", answerText: "Yes." },
    ]);
    expect(output).toBe("Q4. Fourth?\nA4. Yes.");
  });

  it("marks a blank answer instead of leaving an empty line", () => {
    const output = formatTranscript([
      {
        position: 1,
        questionText: "Tell me about yourself.",
        answerText: "   ",
      },
    ]);
    expect(output).toBe("Q1. Tell me about yourself.\nA1. (left blank)");
  });

  it("keeps line breaks inside a multi-line answer", () => {
    const output = formatTranscript([
      {
        position: 1,
        questionText: "Walk me through it.",
        answerText: "First this.\nThen that.",
      },
    ]);
    expect(output).toContain("A1. First this.\nThen that.");
  });

  it("trims surrounding whitespace from both sides of a pair", () => {
    const output = formatTranscript([
      {
        position: 1,
        questionText: "  Padded question?  ",
        answerText: "\n Padded answer \n",
      },
    ]);
    expect(output).toBe("Q1. Padded question?\nA1. Padded answer");
  });
});

describe("formatRubric", () => {
  // Rendered from PILLARS so the weights the model is told about are the same
  // ones score.ts divides by. Hard-coding them here would defeat the point.
  it("lists every pillar with its weight and guidance", () => {
    const rubric = formatRubric();
    for (const pillar of PILLARS) {
      expect(rubric).toContain(pillar.label);
      expect(rubric).toContain(`${pillar.weight}% of the score`);
      expect(rubric).toContain(pillar.guidance);
    }
  });

  it("keeps the pillars in rubric order", () => {
    const positions = PILLARS.map((pillar) =>
      formatRubric().indexOf(pillar.label),
    );
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe("buildPrompt", () => {
  const template = "PREAMBLE\n\n{{transcript}}\n\n{{rubric}}\n\nINSTRUCTIONS";

  it("substitutes the transcript and the rubric", () => {
    expect(buildPrompt(template, turns)).toBe(
      `PREAMBLE\n\n${formatTranscript(turns)}\n\n${formatRubric()}\n\nINSTRUCTIONS`,
    );
  });

  it("leaves no placeholder behind", () => {
    const prompt = buildPrompt(template, turns);
    expect(prompt).not.toContain("{{");
  });

  it("includes every question and answer", () => {
    const prompt = buildPrompt(template, turns);
    for (const turn of turns) {
      expect(prompt).toContain(turn.questionText);
      expect(prompt).toContain(turn.answerText);
    }
  });

  it("replaces every occurrence when the template repeats a placeholder", () => {
    const prompt = buildPrompt(
      "{{transcript}} then {{transcript}} {{rubric}}",
      [
        {
          position: 1,
          questionText: "Only question?",
          answerText: "Only answer.",
        },
      ],
    );
    expect(prompt).not.toContain("{{");
    expect(prompt.match(/Q1\./g)).toHaveLength(2);
  });

  it("refuses an empty transcript", () => {
    expect(() => buildPrompt(template, [])).toThrow(/empty transcript/i);
  });

  it("refuses a template with no transcript placeholder", () => {
    expect(() => buildPrompt("only {{rubric}}", turns)).toThrow(
      /\{\{transcript\}\}/,
    );
  });

  it("refuses a template with no rubric placeholder", () => {
    expect(() => buildPrompt("only {{transcript}}", turns)).toThrow(
      /\{\{rubric\}\}/,
    );
  });
});

describe("the shipped prompt.md", () => {
  // Reads a file colocated with the source, not a database or a network call.
  // Guards against editing the prompt and silently breaking substitution.
  it("contains both placeholders buildPrompt substitutes", () => {
    expect(loadPromptTemplate()).toContain("{{transcript}}");
    expect(loadPromptTemplate()).toContain("{{rubric}}");
  });

  it("renders into a prompt carrying the rubric, the anchors and the answers", () => {
    const prompt = buildPrompt(loadPromptTemplate(), turns);
    expect(prompt).toContain("Strong no-hire");
    expect(prompt).toContain("Strong hire");
    expect(prompt).toContain("55% of the score");
    expect(prompt).toContain("A race in the retry loop.");
    expect(prompt).not.toContain("{{");
  });
});
