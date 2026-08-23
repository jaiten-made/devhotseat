import { describe, expect, it } from "vitest";
import { dayKey } from "./day";
import { type ActivitySession, buildHeatmap, streaks } from "./heatmap";

/** A sunny Sunday, chosen because it is the last day of its week. */
const TODAY = new Date(2026, 7, 23, 20, 30);

function sat(date: Date, answeredCount = 3): ActivitySession {
  return { startedAt: date, answeredCount };
}

function on(key: string, hour = 9): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, hour);
}

describe("buildHeatmap", () => {
  it("draws 53 columns of seven, ending on the week today sits in", () => {
    const map = buildHeatmap([], { today: TODAY });

    expect(map.weeks).toHaveLength(53);
    for (const week of map.weeks) expect(week.days).toHaveLength(7);
    // The window starts on a Monday, so only the last column can be ragged.
    expect(map.from.getDay()).toBe(1);
    expect(dayKey(map.weeks[0]?.monday ?? map.to)).toBe(dayKey(map.from));
    expect(dayKey(map.to)).toBe("2026-08-23");
  });

  it("leaves the future blank rather than drawing empty days", () => {
    // The 23rd is a Sunday: the last column is full, and the one before it
    // has no gaps either.
    const sunday = buildHeatmap([], { today: TODAY });
    expect(sunday.weeks.at(-1)?.days.filter((day) => day === null)).toEqual([]);

    // Move to the Thursday of that week and the last three slots are unborn.
    const thursday = buildHeatmap([], { today: new Date(2026, 7, 20) });
    const last = thursday.weeks.at(-1)?.days ?? [];
    expect(last.slice(0, 4).every((day) => day !== null)).toBe(true);
    expect(last.slice(4)).toEqual([null, null, null]);
  });

  it("marks the day a session was sat, and sums what was answered on it", () => {
    const map = buildHeatmap(
      [sat(on("2026-08-23", 9), 4), sat(on("2026-08-23", 21), 2)],
      { today: TODAY },
    );

    const today = map.weeks.at(-1)?.days.at(-1);
    expect(today?.key).toBe("2026-08-23");
    expect(today?.practised).toBe(true);
    expect(today?.answers).toBe(6);

    // Twice in a day is still one day practised. The square does not grade it.
    expect(map.daysPractised).toBe(1);
  });

  it("leaves a day nothing was sat on unpractised", () => {
    const map = buildHeatmap([sat(on("2026-08-23"))], { today: TODAY });

    const yesterday = map.weeks.at(-1)?.days.at(-2);
    expect(yesterday?.key).toBe("2026-08-22");
    expect(yesterday?.practised).toBe(false);
    expect(yesterday?.answers).toBe(0);
  });

  it("accepts the timestamp as the string a server function serialises", () => {
    const map = buildHeatmap(
      [{ startedAt: on("2026-08-23").toISOString(), answeredCount: 1 }],
      { today: TODAY },
    );
    expect(map.weeks.at(-1)?.days.at(-1)?.practised).toBe(true);
  });

  it("ignores a session nobody answered", () => {
    const map = buildHeatmap([sat(on("2026-08-23"), 0)], { today: TODAY });

    expect(map.weeks.at(-1)?.days.at(-1)?.practised).toBe(false);
    expect(map.daysPractised).toBe(0);
    expect(map.currentStreak).toBe(0);
  });

  it("counts a day inside the window and drops one before it", () => {
    const map = buildHeatmap([sat(on("2026-08-17")), sat(on("2020-01-01"))], {
      today: TODAY,
    });

    expect(map.daysPractised).toBe(1);
  });

  // The graph scrolls; history does not.
  it("streaks over every session, including ones off the left edge", () => {
    const map = buildHeatmap(
      [sat(on("2020-01-01")), sat(on("2020-01-02")), sat(on("2020-01-03"))],
      { today: TODAY },
    );

    expect(map.daysPractised).toBe(0);
    expect(map.longestStreak).toBe(3);
    expect(map.currentStreak).toBe(0);
  });

  it("labels each month once, over the columns whose Monday it owns", () => {
    const map = buildHeatmap([], { today: TODAY });
    const spans = map.months.map((month) => month.span);

    expect(map.months.length).toBeGreaterThanOrEqual(12);
    expect(spans.reduce((total, span) => total + span, 0)).toBe(53);
    // Every run is one month later than the one before it.
    const months = map.months.map((month) => month.start.getMonth());
    for (let index = 1; index < months.length; index += 1) {
      expect((months[index] ?? 0) - ((months[index - 1] ?? 0) + 1)).toBe(
        // December to January wraps by eleven the other way.
        months[index] === 0 ? -12 : 0,
      );
    }
    expect(map.months.at(-1)?.start.getMonth()).toBe(7);
  });
});

describe("streaks", () => {
  const today = new Date(2026, 7, 23, 20, 30);

  it("is zero with nothing practised", () => {
    expect(streaks([], today)).toEqual({ current: 0, longest: 0 });
  });

  it("counts a run ending today", () => {
    expect(streaks(["2026-08-21", "2026-08-22", "2026-08-23"], today)).toEqual({
      current: 3,
      longest: 3,
    });
  });

  // A day that is not over cannot have been missed yet.
  it("keeps a run ending yesterday alive", () => {
    expect(streaks(["2026-08-21", "2026-08-22"], today)).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it("drops to zero once a whole day has been missed", () => {
    expect(streaks(["2026-08-20", "2026-08-21"], today)).toEqual({
      current: 0,
      longest: 2,
    });
  });

  it("remembers the longest run while reporting the current one", () => {
    const days = [
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-22",
      "2026-08-23",
    ];
    expect(streaks(days, today)).toEqual({ current: 2, longest: 4 });
  });

  it("does not care what order the days arrive in", () => {
    expect(streaks(["2026-08-23", "2026-08-21", "2026-08-22"], today)).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it("counts a month boundary as consecutive", () => {
    expect(streaks(["2026-07-31", "2026-08-01"], new Date(2026, 7, 1))).toEqual(
      { current: 2, longest: 2 },
    );
  });
});
