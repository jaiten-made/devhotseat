import { describe, expect, it } from "vitest";
import { parseReportResponse } from "./parse";

function pillar(score: number, evidence = "They named the trade-off.") {
  return { score, evidence };
}

function turn(position: number, score = 3) {
  return {
    position,
    situation: pillar(score),
    task: pillar(score),
    action: pillar(score),
    result: pillar(score),
    learning: pillar(score),
    strength: "Clear ownership.",
    improvement: "Quantify the outcome.",
  };
}

function report(positions: number[] = [1, 2]) {
  return {
    turns: positions.map((position) => turn(position)),
    headline: "Solid stories, vague outcomes.",
    narrative: "You set the scene well but stop short of the result.",
  };
}

const of = (value: unknown) => ({ text: JSON.stringify(value) });

describe("parseReportResponse", () => {
  it("returns the rubric and uses the narrative as the prose", () => {
    const result = parseReportResponse(of(report()), [1, 2]);
    expect(result.structured?.turns).toHaveLength(2);
    expect(result.content).toBe(
      "You set the scene well but stop short of the result.",
    );
  });

  it("accepts output wrapped in a code fence", () => {
    const fenced = { text: `\`\`\`json\n${JSON.stringify(report())}\n\`\`\`` };
    expect(parseReportResponse(fenced, [1, 2]).structured).not.toBeNull();
  });

  it("puts the turns back in position order", () => {
    const result = parseReportResponse(of(report([2, 1])), [1, 2]);
    expect(result.structured?.turns.map((t) => t.position)).toEqual([1, 2]);
  });

  it("trims and caps a rambling evidence sentence", () => {
    const long = { ...report([1]) };
    (long.turns[0] as { action: { evidence: string } }).action.evidence =
      `  ${"x".repeat(600)}  `;
    const result = parseReportResponse(of(long), [1]);
    const evidence = result.structured?.turns[0]?.action.evidence ?? "";
    expect(evidence).toHaveLength(400);
    expect(evidence.endsWith("…")).toBe(true);
  });

  // Prose where JSON was asked for is still a usable report.
  it("keeps plain prose and reports no rubric", () => {
    const result = parseReportResponse({ text: "You came across well." }, [1]);
    expect(result).toEqual({
      content: "You came across well.",
      structured: null,
    });
  });

  // A blob that started as JSON and stopped mid-way is not usable prose.
  it("refuses truncated JSON rather than rendering it as advice", () => {
    expect(() =>
      parseReportResponse({ text: '{"turns":[{"position":1,' }, [1]),
    ).toThrow(/malformed JSON/);
  });

  it("salvages the narrative when a score is off the rubric", () => {
    const result = parseReportResponse(of(report([1])), [1]);
    expect(result.structured).not.toBeNull();

    const broken = report([1]);
    (broken.turns[0] as { action: { score: number } }).action.score = 7;
    const salvaged = parseReportResponse(of(broken), [1]);
    expect(salvaged.structured).toBeNull();
    expect(salvaged.content).toBe(broken.narrative);
  });

  it("salvages when a pillar is missing entirely", () => {
    const broken = report([1]) as Record<string, unknown>;
    delete (broken.turns as Record<string, unknown>[])[0]?.learning;
    const result = parseReportResponse(of(broken), [1]);
    expect(result.structured).toBeNull();
    expect(result.content).toContain("You set the scene well");
  });

  // The scores are joined to the transcript by position, so an invented or
  // missing turn would silently mislabel someone's answer.
  it("salvages when the scored positions do not match the questions asked", () => {
    for (const [scored, expected] of [
      [
        [1, 2],
        [1, 2, 3],
      ],
      [
        [1, 3],
        [1, 2],
      ],
      [
        [1, 1],
        [1, 2],
      ],
    ] as const) {
      const result = parseReportResponse(of(report([...scored])), [
        ...expected,
      ]);
      expect(result.structured).toBeNull();
    }
  });

  it("throws when neither the rubric nor a narrative survives", () => {
    expect(() => parseReportResponse(of({ turns: "nope" }), [1])).toThrow(
      /unusable report/,
    );
  });

  it("throws quoting the finish reason when the model returned nothing", () => {
    expect(() =>
      parseReportResponse(
        { text: "", candidates: [{ finishReason: "SAFETY" }] },
        [1],
      ),
    ).toThrow(/finishReason: SAFETY/);
  });

  it("throws plainly when there is no finish reason either", () => {
    expect(() => parseReportResponse({}, [1])).toThrow(
      /Model returned no report text\./,
    );
  });

  it("never returns empty prose", () => {
    const blank = { ...report([1]), narrative: "   " };
    expect(() => parseReportResponse(of(blank), [1])).toThrow();
  });
});
