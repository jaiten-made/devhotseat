import { PILLARS } from "@/lib/report/rubric";
import type { PillarScores } from "@/lib/report/score";
import { formatScore, SCORE_BG } from "./score-tokens";

const SEGMENTS = [1, 2, 3, 4];

/**
 * A four-cell track rather than a smooth bar. The underlying scale is four
 * whole numbers, and a continuous bar would imply a precision the rubric does
 * not have.
 */
function SegmentedTrack({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <div className="flex h-2 flex-1 gap-0.5" role="presentation">
      {SEGMENTS.map((segment) => {
        // The last filled cell carries the fraction, so 3.4 reads as three
        // cells and a little.
        const fill = Math.min(Math.max(value - (segment - 1), 0), 1);
        return (
          <div
            key={segment}
            className="flex-1 overflow-hidden rounded-[2px] bg-muted"
          >
            <div
              className={`h-full ${SCORE_BG[rounded] ?? "bg-primary"}`}
              style={{ width: `${fill * 100}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Each pillar averaged across every answer, next to what it is worth. */
export function PillarBars({ averages }: { averages: PillarScores }) {
  return (
    <dl className="space-y-4">
      {PILLARS.map((pillar) => (
        <div key={pillar.id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <dt className="flex items-baseline gap-2 text-sm font-medium">
              {pillar.label}
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
                {pillar.weight}% of the score
              </span>
            </dt>
            <dd className="text-sm font-medium tabular-nums">
              {formatScore(averages[pillar.id])}
            </dd>
          </div>
          <SegmentedTrack value={averages[pillar.id]} />
        </div>
      ))}
    </dl>
  );
}
