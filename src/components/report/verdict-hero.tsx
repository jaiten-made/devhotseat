import { Panel } from "@/components/ui/page";
import { band, bandLabel } from "@/lib/report/score";
import { ScoreGauge, ScoreValue } from "./score-gauge";
import { BAND_TEXT, formatScore } from "./score-tokens";

interface VerdictHeroProps {
  readonly score: number;
  readonly headline: string;
  readonly answerCount: number;
}

/**
 * The one thing to take away, before any of the detail underneath it.
 *
 * The panel's decision on the left, the number it came from on the right, and
 * a rule between them — the two halves of an interview scorecard. The verdict
 * is the only place in the report set at heading size, because it is the only
 * thing here that is a conclusion rather than a measurement.
 */
export function VerdictHero({
  score,
  headline,
  answerCount,
}: VerdictHeroProps) {
  // Band off the unrounded score: a 3.24 displayed as "3.2" is still a
  // leaning hire, and rounding first would promote it.
  const verdict = band(score);

  return (
    <Panel>
      <div className="flex flex-col divide-y divide-rule sm:flex-row sm:divide-x sm:divide-y-0">
        <div className="min-w-0 flex-1 p-6">
          <p className="field-label">Verdict</p>
          <p
            className={`mt-2.5 text-2xl font-semibold leading-none tracking-tight ${BAND_TEXT[verdict]}`}
          >
            {bandLabel(verdict)}
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
            {headline}
          </p>
        </div>

        <div className="shrink-0 p-6 sm:w-52">
          <p className="field-label">Overall</p>
          <p className="mt-2">
            <ScoreValue
              value={formatScore(score)}
              size="lg"
              className={BAND_TEXT[verdict]}
            />
          </p>
          <ScoreGauge value={score} className="mt-3.5" />
          <p className="mt-2.5 text-xs text-ink-faint">
            {answerCount} {answerCount === 1 ? "answer" : "answers"} scored
          </p>
        </div>
      </div>
    </Panel>
  );
}
