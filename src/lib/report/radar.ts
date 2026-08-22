import { MAX_SCORE } from "./rubric";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Two decimal places, so the generated path strings are stable to assert on. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Where axis `index` of `count` sits at a given radius. Index 0 points straight
 * up and the rest run clockwise, which is what makes Situation the apex.
 */
export function axisPoint(
  index: number,
  count: number,
  radius: number,
  cx: number,
  cy: number,
): Point {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
  return {
    x: round(cx + radius * Math.cos(angle)),
    y: round(cy + radius * Math.sin(angle)),
  };
}

function toPath(points: ReadonlyArray<Point>): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

/**
 * The data polygon. Scores map onto the radius directly — a 1 sits at a quarter
 * of the radius rather than collapsing to a point, so a weak session still
 * draws a readable shape instead of a dot.
 */
export function polygonPoints(
  values: ReadonlyArray<number>,
  radius: number,
  cx: number,
  cy: number,
): string {
  return toPath(
    values.map((value, index) =>
      axisPoint(index, values.length, (value / MAX_SCORE) * radius, cx, cy),
    ),
  );
}

/** One of the background rings, at score level 1 through 4. */
export function ringPoints(
  level: number,
  radius: number,
  cx: number,
  cy: number,
  count: number,
): string {
  const scaled = (level / MAX_SCORE) * radius;
  return toPath(
    Array.from({ length: count }, (_, index) =>
      axisPoint(index, count, scaled, cx, cy),
    ),
  );
}

/**
 * Keeps axis labels off the chart: those on the left hang right-aligned, those
 * on the right left-aligned, and the apex and base centre.
 */
export function labelAnchor(
  point: Point,
  cx: number,
): "start" | "middle" | "end" {
  if (Math.abs(point.x - cx) < 1) return "middle";
  return point.x > cx ? "start" : "end";
}
