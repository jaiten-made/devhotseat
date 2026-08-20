import { describe, expect, it } from "vitest";
import { SESSION_LENGTH } from "./config";

describe("SESSION_LENGTH", () => {
  // This constant is expected to be edited by hand during testing. A value
  // that is zero, negative, or fractional would let a session start with no
  // questions or never reach its final turn, so guard the shape rather than
  // the specific number.
  it("is a positive integer", () => {
    expect(Number.isInteger(SESSION_LENGTH)).toBe(true);
    expect(SESSION_LENGTH).toBeGreaterThan(0);
  });
});
