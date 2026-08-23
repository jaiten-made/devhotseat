import { describe, expect, it } from "vitest";
import { addDays, dayKey, dayStart, startOfWeek } from "./day";

describe("dayKey", () => {
  it("keys by the local day, zero-padded", () => {
    expect(dayKey(new Date(2026, 7, 9, 23, 59))).toBe("2026-08-09");
    expect(dayKey(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });

  it("sorts chronologically as a string", () => {
    const keys = ["2026-10-01", "2026-02-09", "2026-02-10"];
    expect([...keys].sort()).toEqual([
      "2026-02-09",
      "2026-02-10",
      "2026-10-01",
    ]);
  });
});

describe("dayStart", () => {
  it("round-trips a key to local midnight and back", () => {
    const midnight = dayStart("2026-08-23");
    expect(midnight.getHours()).toBe(0);
    expect(dayKey(midnight)).toBe("2026-08-23");
  });

  // `new Date("2026-08-23")` is parsed as UTC, which puts the day before
  // midnight anywhere west of Greenwich. Parsing by hand is the whole point.
  it("does not go through UTC", () => {
    expect(dayStart("2026-08-23").getDate()).toBe(23);
  });

  it("refuses something that is not a day key", () => {
    expect(() => dayStart("yesterday")).toThrow(/day key/);
  });
});

describe("addDays", () => {
  it("crosses a month and a year", () => {
    expect(dayKey(addDays(new Date(2026, 7, 31), 1))).toBe("2026-09-01");
    expect(dayKey(addDays(new Date(2026, 11, 31), 1))).toBe("2027-01-01");
    expect(dayKey(addDays(new Date(2026, 0, 1), -1))).toBe("2025-12-31");
  });

  it("lands on midnight of the target day, whatever time it started at", () => {
    const stepped = addDays(new Date(2026, 7, 23, 21, 30), 1);
    expect(dayKey(stepped)).toBe("2026-08-24");
    expect(stepped.getHours()).toBe(0);
  });

  it("steps a whole calendar day, not 24 hours", () => {
    // Sydney's clocks go back on 5 April 2026, so that day is 25 hours long.
    // Adding milliseconds would land on the 4th again; asking the calendar
    // cannot. The assertion holds in any zone, including ones with no DST.
    const before = new Date(2026, 3, 4);
    expect(dayKey(addDays(before, 1))).toBe("2026-04-05");
    expect(dayKey(addDays(before, 2))).toBe("2026-04-06");
  });
});

describe("startOfWeek", () => {
  it("returns the Monday of the week a day falls in", () => {
    // 2026-08-23 is a Sunday, so its week began on the 17th.
    expect(dayKey(startOfWeek(new Date(2026, 7, 23)))).toBe("2026-08-17");
    expect(dayKey(startOfWeek(new Date(2026, 7, 17)))).toBe("2026-08-17");
    expect(dayKey(startOfWeek(new Date(2026, 7, 21)))).toBe("2026-08-17");
  });

  it("puts Sunday at the end of its week rather than the start", () => {
    const sunday = new Date(2026, 7, 23);
    expect(sunday.getDay()).toBe(0);
    expect(startOfWeek(sunday) < sunday).toBe(true);
  });
});
