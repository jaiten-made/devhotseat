import { addDays } from "@/lib/activity/day";
import type { Heatmap, HeatmapDay, Level } from "@/lib/activity/heatmap";
import { cn } from "@/lib/utils";

/**
 * A year of practice, one square a day, the way a contribution graph does it.
 *
 * The ramp is one ink at four densities. A heatmap is a sequential scale, and
 * the rule in this app is that colour says how something scored — a count of
 * sittings is not a judgement, so it stays grey and lets density carry "more".
 * That is all GitHub's green is doing too; the hue is decoration on it.
 * See [27](../../../docs/adr/0027-greyscale-with-colour-reserved-for-judgements.md).
 *
 * Written out in full rather than interpolated, because Tailwind finds class
 * names by scanning source text and `bg-ink/${n}` compiles to nothing. Same
 * reason as the report's score tokens.
 */
const LEVEL_FILL: Record<Level, string> = {
  0: "bg-ink/8",
  1: "bg-ink/35",
  2: "bg-ink/65",
  3: "bg-ink",
};

/** The three steps that need explaining. An empty square explains itself. */
const KEY_STEPS: ReadonlyArray<{ level: Level; label: string }> = [
  { level: 1, label: "1" },
  { level: 2, label: "2" },
  { level: 3, label: "3+" },
];

const MONTH = new Intl.DateTimeFormat(undefined, { month: "short" });
const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const DAY = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Monday, Wednesday, Friday. Naming all seven rows in a 10px grid is a wall. */
const LABELLED_ROWS = new Set([0, 2, 4]);

export function StreakHeatmap({ heatmap }: { heatmap: Heatmap }) {
  return (
    <div className="space-y-4">
      {/* A year of weeks is wider than a phone. It scrolls rather than
          reflowing: a contribution graph with wrapped weeks is no longer one. */}
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[2px]">
          <caption className="sr-only">
            Practice by day, from {DAY.format(heatmap.from)} to{" "}
            {DAY.format(heatmap.to)}, one square a day and darker for more
            sessions. Only the days practised are read out.
          </caption>
          <thead>
            <tr>
              {/* The corner above the weekday names. */}
              <td />
              {heatmap.months.map((month) => (
                <th
                  key={month.start.toISOString()}
                  scope="colgroup"
                  colSpan={month.span}
                  className="field-label pb-1 text-left font-medium"
                >
                  {/* Three letters need three columns under them. A month
                      the window only caught the tail of goes unlabelled
                      rather than sitting on top of its neighbour. */}
                  {month.span > 2 ? MONTH.format(month.start) : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekdayRows(heatmap.from).map(({ row, date }) => (
              <tr key={date.toISOString()}>
                <th
                  scope="row"
                  className="field-label pr-1.5 text-right align-middle font-medium"
                >
                  {LABELLED_ROWS.has(row) ? WEEKDAY.format(date) : ""}
                </th>
                {heatmap.weeks.map((week) => (
                  // The week and the weekday name the square between them,
                  // which holds even where the day itself is not born yet.
                  <Cell
                    key={`${week.monday.toISOString()}-${row}`}
                    day={week.days[row] ?? null}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4">
        <p className="field-label">Sessions a day</p>
        <ul className="flex items-center gap-3">
          {KEY_STEPS.map((step) => (
            <li key={step.level} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn("size-2.5 rounded-[2px]", LEVEL_FILL[step.level])}
              />
              <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                {step.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * One day. The square is the hit target and carries its own tooltip, which is
 * what a grid of marks has instead of an axis to read against.
 *
 * Only a day that was practised is spoken. Announcing all three hundred and
 * seventy squares would read out "no practice on" three hundred times to say
 * what the streak numbers above already say in two.
 */
function Cell({ day }: { day: HeatmapDay | null }) {
  if (!day) return <td />;
  const label = describeDay(day);
  return (
    <td className="p-0">
      <div
        title={label}
        className={cn(
          "size-2.5 rounded-[2px] transition-shadow hover:ring-1 hover:ring-ink/40",
          LEVEL_FILL[day.level],
        )}
      >
        {day.sessions > 0 && <span className="sr-only">{label}</span>}
      </div>
    </td>
  );
}

/** The seven rows, each carrying a date from the first week to name itself by. */
function weekdayRows(from: Date): Array<{ row: number; date: Date }> {
  return [0, 1, 2, 3, 4, 5, 6].map((row) => ({
    row,
    date: addDays(from, row),
  }));
}

function describeDay(day: HeatmapDay): string {
  const date = DAY.format(day.date);
  if (day.sessions === 0) return `No practice on ${date}`;
  return `${count(day.sessions, "session")}, ${count(day.answers, "answer")} on ${date}`;
}

function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}
