import { PILLARS } from "@/lib/report/rubric";
import type { PillarScores } from "@/lib/report/score";
import { ScoreGauge, ScoreValue } from "./score-gauge";
import { formatScore } from "./score-tokens";

/**
 * Each pillar averaged across every answer, next to what it is worth.
 *
 * A real table rather than a definition list: this is three columns of aligned
 * data, and the weights only make sense once the column they sit in is named.
 * Naming it once in a header beats repeating "of the score" on all five rows,
 * which is what the chips beside each label used to do.
 */
export function PillarBars({ averages }: { averages: PillarScores }) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">
        The five STAR-L pillars, what each is worth, and the average score
        across every answer
      </caption>
      <thead>
        <tr className="border-b border-rule">
          <th scope="col" className="field-label pb-2 font-medium">
            Pillar
          </th>
          <th scope="col" className="field-label pb-2 text-right font-medium">
            Weight
          </th>
          <th scope="col" className="field-label pb-2 text-right font-medium">
            Score
          </th>
        </tr>
      </thead>
      <tbody>
        {PILLARS.map((pillar) => (
          <tr key={pillar.id} className="border-b border-rule last:border-0">
            <th
              scope="row"
              className="py-2.5 pr-3 text-sm font-medium leading-none"
            >
              {pillar.label}
            </th>
            <td className="py-2.5 pr-4 text-right">
              <span className="font-mono text-xs tabular-nums text-ink-faint">
                {pillar.weight}%
              </span>
            </td>
            <td className="py-2.5">
              <div className="flex items-center justify-end gap-2.5">
                <ScoreGauge value={averages[pillar.id]} size="sm" />
                <ScoreValue
                  value={formatScore(averages[pillar.id])}
                  className="w-7 text-right"
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
