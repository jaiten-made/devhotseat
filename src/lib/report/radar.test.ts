import { describe, expect, it } from "vitest";
import { axisPoint, labelAnchor, polygonPoints, ringPoints } from "./radar";

const CX = 120;
const CY = 100;
const R = 70;

describe("axisPoint", () => {
  it("puts the first axis straight up", () => {
    expect(axisPoint(0, 5, R, CX, CY)).toEqual({ x: CX, y: CY - R });
  });

  it("spaces five axes 72 degrees apart, running clockwise", () => {
    // The second axis is up-and-right: 72 degrees round from the apex.
    const second = axisPoint(1, 5, R, CX, CY);
    expect(second.x).toBeGreaterThan(CX);
    expect(second.y).toBeLessThan(CY);

    const third = axisPoint(2, 5, R, CX, CY);
    expect(third.x).toBeGreaterThan(CX);
    expect(third.y).toBeGreaterThan(CY);
  });

  it("stays on the centre when the radius is zero", () => {
    expect(axisPoint(3, 5, 0, CX, CY)).toEqual({ x: CX, y: CY });
  });
});

describe("polygonPoints", () => {
  it("lands a top score on the outer ring", () => {
    const points = polygonPoints([4, 4, 4, 4, 4], R, CX, CY);
    expect(points.split(" ")[0]).toBe(`${CX},${CY - R}`);
  });

  // A 1 keeps a quarter of the radius so a weak session draws a shape, not a dot.
  it("keeps the lowest score at a quarter of the radius", () => {
    const points = polygonPoints([1, 1, 1, 1, 1], R, CX, CY);
    expect(points.split(" ")[0]).toBe(`${CX},${CY - R / 4}`);
  });

  it("emits one x,y pair per value", () => {
    expect(polygonPoints([1, 2, 3, 4, 2], R, CX, CY).split(" ")).toHaveLength(
      5,
    );
  });
});

describe("ringPoints", () => {
  it("draws the outermost ring at the full radius", () => {
    expect(ringPoints(4, R, CX, CY, 5).split(" ")[0]).toBe(`${CX},${CY - R}`);
  });

  it("nests the inner rings inside it", () => {
    const yOf = (level: number) =>
      Number(ringPoints(level, R, CX, CY, 5).split(" ")[0]?.split(",")[1]);
    const inner = yOf(1);
    const outer = yOf(4);
    expect(inner).toBeGreaterThan(outer);
  });
});

describe("labelAnchor", () => {
  it("centres the apex and the base, and hangs the sides outward", () => {
    expect(labelAnchor({ x: CX, y: 30 }, CX)).toBe("middle");
    expect(labelAnchor({ x: CX + 60, y: 100 }, CX)).toBe("start");
    expect(labelAnchor({ x: CX - 60, y: 100 }, CX)).toBe("end");
  });
});
