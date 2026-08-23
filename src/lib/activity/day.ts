/**
 * Calendar days, in the timezone the user is actually standing in.
 *
 * A practice day is the day the person had, not the day UTC was having. A
 * session sat at nine on a Brisbane evening belongs to that evening; bucketed
 * by UTC it would file itself under tomorrow and break the streak the evening
 * was part of. So every function here reads and writes local components —
 * `getFullYear` and friends, never `getUTC*` — and the bucketing runs in the
 * browser, which is the only party that knows what timezone the user is in.
 * Postgres, in the compose file, runs on UTC and is not asked.
 *
 * The arithmetic goes through the `Date` constructor rather than adding
 * milliseconds, because a day is not always 86,400,000 ms long. Adding a day
 * across the end of daylight saving lands an hour out, and an hour out at
 * midnight is a different date.
 */

/** A calendar day as `YYYY-MM-DD`, local. Sorts chronologically as a string. */
export type DayKey = string;

const pad = (value: number) => String(value).padStart(2, "0");

/** The local day an instant fell on. */
export function dayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Local midnight on the day a key names.
 *
 * Parsed by hand rather than through `new Date("2026-08-23")`, which the spec
 * reads as UTC — that is the bug this whole module exists to avoid, and it is
 * one character away in every direction.
 */
export function dayStart(key: DayKey): Date {
  const [year, month, day] = key.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Not a day key: "${key}".`);
  }
  return new Date(year, month - 1, day);
}

/** Local midnight `count` days from the day `date` falls on. */
export function addDays(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
}

/**
 * The Monday of the week `date` falls in, at local midnight.
 *
 * Weeks start on Monday: the ISO convention, and the one on the wall of the
 * person using this. GitHub's own graph starts on Sunday, which is a US
 * calendar rather than a property of the chart.
 */
export function startOfWeek(date: Date): Date {
  // getDay is 0 for Sunday, so Sunday is six days into its week, not minus one.
  const weekday = (date.getDay() + 6) % 7;
  return addDays(date, -weekday);
}
