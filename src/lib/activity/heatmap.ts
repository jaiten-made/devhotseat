import { addDays, type DayKey, dayKey, dayStart, startOfWeek } from "./day";

/**
 * The streak heatmap: a year of practice as a grid of days, plus the two
 * numbers a habit is actually judged by.
 *
 * All of it is derived in the browser from the session list the Sessions
 * screen already loads. There is no analytics query and no new table: this app
 * holds one person's sessions, so a `GROUP BY` on the server would be a round
 * trip to count a few hundred rows the client has in hand. If the log ever
 * outgrows that, the shape below is what an aggregate query would return, and
 * only `buildHeatmap`'s first ten lines would move.
 */

/**
 * What a day of practice is counted from: when the session was sat, and how
 * much of it was answered. Structurally what `listSessions` already returns,
 * so the dashboard reuses that query rather than adding one.
 */
export interface ActivitySession {
  readonly startedAt: string | Date;
  readonly answeredCount: number;
}

export interface HeatmapDay {
  readonly key: DayKey;
  /** Local midnight, for formatting the day's label. */
  readonly date: Date;
  /**
   * Whether the day was practised, which is the whole of what a square says.
   * A day held one session or four; the map does not grade it. Sitting down
   * is the habit, and how many times in one afternoon is a detail the streak
   * does not turn on.
   */
  readonly practised: boolean;
  /** How much was answered that day, for the day's own label. */
  readonly answers: number;
}

/** A run of columns belonging to one month, for the labels along the top. */
export interface MonthRun {
  readonly start: Date;
  readonly span: number;
}

/**
 * A column of the grid. `days` runs Monday to Sunday and holds null only where
 * a slot falls after today, which can happen in the last column and nowhere
 * else — the window starts on a Monday, so no column is ragged at its front.
 * The Monday is kept beside the days because it identifies the column whether
 * or not the days in it have happened yet.
 */
export interface HeatmapWeek {
  readonly monday: Date;
  readonly days: ReadonlyArray<HeatmapDay | null>;
}

export interface Heatmap {
  readonly weeks: ReadonlyArray<HeatmapWeek>;
  readonly months: ReadonlyArray<MonthRun>;
  readonly from: Date;
  readonly to: Date;
  /** Totals over the window drawn, not over all history. */
  readonly daysPractised: number;
  /**
   * Streaks over every session given, including any older than the window.
   * A streak the graph has scrolled past is still a streak that happened.
   */
  readonly currentStreak: number;
  readonly longestStreak: number;
}

/** 53 columns: a year, plus the part-week today sits in. */
const WEEKS = 53;

export function buildHeatmap(
  sessions: ReadonlyArray<ActivitySession>,
  { today, weeks = WEEKS }: { today: Date; weeks?: number },
): Heatmap {
  // Answers, by the day they were given on. A day is in this map if and only
  // if it was practised, which is all a square needs to know.
  const byDay = new Map<DayKey, number>();
  for (const session of sessions) {
    // A session nobody answered is not practice: the room was opened and left
    // again. Ending a session early is still practice, for the part that was
    // answered, which is the same line the report generator draws.
    if (session.answeredCount <= 0) continue;
    const key = dayKey(new Date(session.startedAt));
    byDay.set(key, (byDay.get(key) ?? 0) + session.answeredCount);
  }

  const to = dayStart(dayKey(today));
  const from = startOfWeek(addDays(to, -(weeks - 1) * 7));

  const grid: HeatmapWeek[] = [];
  let daysPractised = 0;

  for (let week = 0; week < weeks; week += 1) {
    const column: Array<HeatmapDay | null> = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = addDays(from, week * 7 + weekday);
      // Both sides are local midnight, so this compares dates and not clocks.
      if (date > to) {
        column.push(null);
        continue;
      }
      const key = dayKey(date);
      const answers = byDay.get(key);
      if (answers !== undefined) daysPractised += 1;
      column.push({
        key,
        date,
        practised: answers !== undefined,
        answers: answers ?? 0,
      });
    }
    grid.push({ monday: addDays(from, week * 7), days: column });
  }

  const { current, longest } = streaks(byDay.keys(), today);

  return {
    weeks: grid,
    months: monthRuns(grid),
    from,
    to,
    daysPractised,
    currentStreak: current,
    longestStreak: longest,
  };
}

/**
 * A month owns the columns whose Monday falls in it, which is how the labels
 * end up over roughly the right stretch of grid without any of them being
 * placed twice. Runs are returned unlabelled: whether three letters fit over
 * a run this narrow is a question about pixels, so the component answers it.
 */
function monthRuns(grid: ReadonlyArray<HeatmapWeek>): MonthRun[] {
  const runs: MonthRun[] = [];
  let previous: string | null = null;
  for (const { monday } of grid) {
    const month = `${monday.getFullYear()}-${monday.getMonth()}`;
    const last = runs[runs.length - 1];
    if (last && month === previous) {
      runs[runs.length - 1] = { start: last.start, span: last.span + 1 };
    } else {
      runs.push({ start: monday, span: 1 });
    }
    previous = month;
  }
  return runs;
}

/**
 * The current run and the longest one ever.
 *
 * A day that is not over yet cannot break a streak, so a run ending yesterday
 * is still current — otherwise the number a user reads at breakfast is a zero
 * that punishes them for not having practised before breakfast. It goes to
 * zero at the end of the first day actually missed.
 */
export function streaks(
  days: Iterable<DayKey>,
  today: Date,
): { current: number; longest: number } {
  // `YYYY-MM-DD` sorts chronologically, which is most of why days are keyed
  // this way rather than held as `Date`s.
  const sorted = [...days].sort();

  let longest = 0;
  let run = 0;
  let previous: DayKey | null = null;
  for (const key of sorted) {
    const consecutive =
      previous !== null && key === dayKey(addDays(dayStart(previous), 1));
    run = consecutive ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = key;
  }

  const alive =
    previous === dayKey(today) || previous === dayKey(addDays(today, -1));
  return { current: alive ? run : 0, longest };
}
