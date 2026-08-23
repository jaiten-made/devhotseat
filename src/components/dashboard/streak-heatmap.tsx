import { addDays } from "@/lib/activity/day";
import type { Heatmap, HeatmapDay } from "@/lib/activity/heatmap";
import { cn } from "@/lib/utils";

/**
 * A year of practice, one square a day, the way a contribution graph does it.
 *
 * A square is filled or it is not. The map answers the question a streak is
 * made of — did I sit down that day — and shading it by how many times over
 * answered one nobody asked. Two weights of one ink also need no key: filled
 * and empty explain themselves, where four steps of grey had to be legended.
 *
 * Grey rather than a hue because colour in this app says how an answer scored,
 * and sitting down is not a judgement. That is all GitHub's green is doing
 * too; the hue is decoration on it. See
 * [27](../../../docs/adr/0027-greyscale-with-colour-reserved-for-judgements.md).
 */
const PRACTISED = "bg-ink";
const UNPRACTISED = "bg-ink/8";

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
    // A year of weeks is wider than a phone. It scrolls rather than reflowing:
    // a contribution graph with wrapped weeks is no longer one.
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-[2px]">
        <caption className="sr-only">
          Practice by day, from {DAY.format(heatmap.from)} to{" "}
          {DAY.format(heatmap.to)}, one square a day and filled for every day
          practised. Only the days practised are read out.
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
                {/* Three letters need three columns under them. A month the
                    window only caught the tail of goes unlabelled rather than
                    sitting on top of its neighbour. */}
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
  );
}

/**
 * One day. The square is the hit target and carries its own tooltip, which is
 * what a grid of marks has instead of an axis to read against.
 *
 * The tooltip names the date and stops there. Whether the day was practised is
 * already on the screen — that is what the fill is — and a count of answers was
 * a second number to read in a graph that is about one thing: did I sit down.
 *
 * Only a day that was practised is spoken. Announcing all three hundred and
 * seventy squares would read out "no practice on" three hundred times to say
 * what the streak numbers above already say in two.
 */
function Cell({ day }: { day: HeatmapDay | null }) {
  if (!day) return <td />;
  const label = DAY.format(day.date);
  return (
    <td className="p-0">
      <div
        title={label}
        className={cn(
          "size-2.5 rounded-[2px] transition-shadow hover:ring-1 hover:ring-ink/40",
          day.practised ? PRACTISED : UNPRACTISED,
        )}
      >
        {day.practised && <span className="sr-only">{label}</span>}
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
