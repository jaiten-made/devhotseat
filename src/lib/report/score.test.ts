import { describe, expect, it } from "vitest";
import type { TurnAssessment } from "./schema";
import {
  asPercent,
  band,
  bandLabel,
  type PillarScores,
  pillarAverages,
  scoresOf,
  sessionScore,
  turnScore,
} from "./score";

function flat(score: number): PillarScores {
  return {
    situation: score,
    task: score,
    action: score,
    result: score,
    learning: score,
  };
}

describe("turnScore", () => {
  it("bottoms out at 1 and tops out at 4", () => {
    expect(turnScore(flat(1))).toBe(1);
    expect(turnScore(flat(4))).toBe(4);
  });

  it("weights a mixed answer by hand-computed maths", () => {
    // 12*4 + 8*3 + 55*2 + 17*1 + 8*4 = 48 + 24 + 110 + 17 + 32 = 231
    const scores: PillarScores = {
      situation: 4,
      task: 3,
      action: 2,
      result: 1,
      learning: 4,
    };
    expect(turnScore(scores)).toBeCloseTo(2.31, 10);
  });

  // The whole point of the weighting: execution outweighs framing.
  it("moves further on Action than on any other pillar", () => {
    const base = turnScore(flat(2));
    const withAction = turnScore({ ...flat(2), action: 3 }) - base;
    for (const pillar of ["situation", "task", "result", "learning"] as const) {
      const delta = turnScore({ ...flat(2), [pillar]: 3 }) - base;
      expect(withAction).toBeGreaterThan(delta);
    }
  });
});

describe("sessionScore", () => {
  it("is the plain mean of the turn scores", () => {
    expect(sessionScore([flat(1), flat(3)])).toBe(2);
  });

  it("counts every question equally regardless of how many there are", () => {
    expect(sessionScore([flat(4), flat(4), flat(4)])).toBe(4);
  });

  it("refuses a session with nothing assessed", () => {
    expect(() => sessionScore([])).toThrow(/no assessed turns/);
  });
});

describe("pillarAverages", () => {
  it("averages each pillar across the answers", () => {
    const averages = pillarAverages([
      { situation: 1, task: 2, action: 3, result: 4, learning: 1 },
      { situation: 3, task: 4, action: 1, result: 2, learning: 3 },
    ]);
    expect(averages).toEqual({
      situation: 2,
      task: 3,
      action: 2,
      result: 3,
      learning: 2,
    });
  });

  it("refuses an empty session", () => {
    expect(() => pillarAverages([])).toThrow(/no assessed turns/);
  });
});

describe("asPercent", () => {
  it("puts the floor at 0 and the ceiling at 100", () => {
    expect(asPercent(1)).toBe(0);
    expect(asPercent(4)).toBe(100);
    expect(asPercent(2.5)).toBe(50);
  });

  it("clamps anything outside the scale", () => {
    expect(asPercent(0)).toBe(0);
    expect(asPercent(9)).toBe(100);
  });
});

describe("band", () => {
  // Boundaries are lower-inclusive quarters of [1, 4].
  it("splits on 1.75, 2.5 and 3.25", () => {
    expect(band(1)).toBe("strong_no_hire");
    expect(band(1.74)).toBe("strong_no_hire");
    expect(band(1.75)).toBe("leaning_no_hire");
    expect(band(2.49)).toBe("leaning_no_hire");
    expect(band(2.5)).toBe("leaning_hire");
    expect(band(3.24)).toBe("leaning_hire");
    expect(band(3.25)).toBe("strong_hire");
    expect(band(4)).toBe("strong_hire");
  });

  it("labels every band", () => {
    expect(bandLabel(band(1))).toBe("Strong no-hire");
    expect(bandLabel(band(2))).toBe("Leaning no-hire");
    expect(bandLabel(band(3))).toBe("Leaning hire");
    expect(bandLabel(band(4))).toBe("Strong hire");
  });
});

describe("scoresOf", () => {
  it("drops the evidence and keeps the numbers", () => {
    const turn = {
      position: 1,
      situation: { score: 1, evidence: "a" },
      task: { score: 2, evidence: "b" },
      action: { score: 3, evidence: "c" },
      result: { score: 4, evidence: "d" },
      learning: { score: 2, evidence: "e" },
      strength: "s",
      improvement: "i",
    } satisfies TurnAssessment;
    expect(scoresOf(turn)).toEqual({
      situation: 1,
      task: 2,
      action: 3,
      result: 4,
      learning: 2,
    });
  });
});
