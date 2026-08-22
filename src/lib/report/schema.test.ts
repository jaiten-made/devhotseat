import { describe, expect, it } from "vitest";
import { structuredReportSchema } from "./schema";

function pillar(score: number) {
  return { score, evidence: "They said something specific." };
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

const valid = {
  turns: [turn(1), turn(2, 4)],
  headline: "A solid session with vague outcomes.",
  narrative: "You told the story well.",
};

describe("structuredReportSchema", () => {
  it("accepts a well-formed report", () => {
    const result = structuredReportSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data?.turns[1]?.action.score).toBe(4);
  });

  it("rejects scores outside the 1-4 rubric", () => {
    for (const score of [0, 5, -1]) {
      const report = { ...valid, turns: [turn(1, score)] };
      expect(structuredReportSchema.safeParse(report).success).toBe(false);
    }
  });

  it("rejects a fractional score", () => {
    const report = { ...valid, turns: [turn(1, 2.5)] };
    expect(structuredReportSchema.safeParse(report).success).toBe(false);
  });

  it("requires all five pillars on every turn", () => {
    const { action, ...missingAction } = turn(1);
    const report = { ...valid, turns: [missingAction] };
    expect(structuredReportSchema.safeParse(report).success).toBe(false);
  });

  it("requires a headline and a narrative", () => {
    const { narrative, ...noNarrative } = valid;
    expect(structuredReportSchema.safeParse(noNarrative).success).toBe(false);
  });

  it("rejects a report with no turns at all", () => {
    expect(
      structuredReportSchema.safeParse({ ...valid, turns: [] }).success,
    ).toBe(false);
  });

  // Positions are 1-based turn numbers, matching the database.
  it("rejects a position below 1", () => {
    const report = { ...valid, turns: [turn(0)] };
    expect(structuredReportSchema.safeParse(report).success).toBe(false);
  });
});
