import { describe, expect, it } from "vitest";
import { micLevel } from "./use-mic-level";

describe("micLevel", () => {
  it("sits at zero in silence", () => {
    expect(micLevel(0, 0)).toBe(0);
  });

  it("rises towards a loud reading rather than jumping to it", () => {
    // Smoothing is the whole point: a single loud frame must not snap the
    // avatar wide open, or speech reads as a strobe.
    const first = micLevel(1, 0);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
    expect(micLevel(1, first)).toBeGreaterThan(first);
  });

  it("decays towards zero once the speaking stops", () => {
    const quieting = micLevel(0, 0.8);
    expect(quieting).toBeLessThan(0.8);
    expect(quieting).toBeGreaterThan(0);
  });

  it("converges on 1 while shouting, and never past it", () => {
    let level = 0;
    for (let frame = 0; frame < 200; frame++) level = micLevel(10, level);
    expect(level).toBeLessThanOrEqual(1);
    expect(level).toBeGreaterThan(0.99);
  });

  it("converges on 0 in silence, and never below it", () => {
    let level = 1;
    for (let frame = 0; frame < 200; frame++) level = micLevel(0, level);
    expect(level).toBeGreaterThanOrEqual(0);
    expect(level).toBeLessThan(0.01);
  });

  it("treats a negative reading as silence", () => {
    // Root mean square cannot be negative, but a clamp is cheaper than
    // trusting that and rendering scale(0.9) if it ever is.
    expect(micLevel(-5, 0)).toBe(0);
  });

  it("is monotonic in loudness", () => {
    const quiet = micLevel(0.01, 0);
    const loud = micLevel(0.1, 0);
    expect(loud).toBeGreaterThan(quiet);
  });
});
