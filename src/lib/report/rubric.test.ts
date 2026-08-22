import { describe, expect, it } from "vitest";
import { PILLARS, WEIGHT_TOTAL } from "./rubric";

/** The documented band each weighting had to be chosen from. */
const BANDS: Record<string, readonly [number, number]> = {
  situation: [10, 15],
  task: [5, 10],
  action: [50, 60],
  result: [15, 20],
  learning: [5, 10],
};

describe("PILLARS", () => {
  it("weights add up to the total the score divides by", () => {
    const sum = PILLARS.reduce((total, pillar) => total + pillar.weight, 0);
    expect(sum).toBe(WEIGHT_TOTAL);
  });

  it("keeps every weight inside its documented band", () => {
    for (const pillar of PILLARS) {
      const [low, high] = BANDS[pillar.id] ?? [0, 100];
      expect(pillar.weight).toBeGreaterThanOrEqual(low);
      expect(pillar.weight).toBeLessThanOrEqual(high);
    }
  });

  it("leaves Action unable to be outvoted by the other four", () => {
    const action = PILLARS.find((pillar) => pillar.id === "action");
    const rest = PILLARS.filter((pillar) => pillar.id !== "action").reduce(
      (total, pillar) => total + pillar.weight,
      0,
    );
    expect(action?.weight).toBeGreaterThan(rest);
  });

  // The order is the radar's axis order, the bar order and the prompt's rubric
  // order. Changing it silently reshapes the chart, so pin it.
  it("pins the ids and their order", () => {
    expect(PILLARS.map((pillar) => pillar.id)).toEqual([
      "situation",
      "task",
      "action",
      "result",
      "learning",
    ]);
  });

  it("gives every pillar a label and guidance for the prompt", () => {
    for (const pillar of PILLARS) {
      expect(pillar.label).not.toBe("");
      expect(pillar.guidance).not.toBe("");
    }
  });
});
