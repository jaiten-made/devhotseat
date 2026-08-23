import { Panel } from "@/components/ui/page";
import type { Heatmap } from "@/lib/activity/heatmap";

/**
 * The three numbers the grid is hard to read off it: the run you are on, the
 * best run you have had, and how many days of the year hold anything at all.
 *
 * Set in the data face, like every other number in the app. They sit above the
 * heatmap rather than beside it because they are the answer and the grid is
 * the working.
 */
export function StreakStats({ heatmap }: { heatmap: Heatmap }) {
  return (
    <Panel>
      <dl className="grid grid-cols-3 divide-x divide-rule">
        <Stat label="Current streak" value={heatmap.currentStreak} unit="day" />
        <Stat label="Longest streak" value={heatmap.longestStreak} unit="day" />
        <Stat label="Days practised" value={heatmap.daysPractised} unit="day" />
      </dl>
    </Panel>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="px-5 py-4">
      <dt className="field-label">{label}</dt>
      {/* Inline rather than a flex row with a gap: the space between the
          number and its unit is a real space, so the pair is one phrase to a
          screen reader instead of "3days". */}
      <dd className="mt-2.5 leading-none">
        <span className="font-mono text-[1.75rem] font-semibold tabular-nums">
          {value}
        </span>
        <span className="text-sm text-ink-muted">
          {" "}
          {unit}
          {value === 1 ? "" : "s"}
        </span>
      </dd>
    </div>
  );
}
