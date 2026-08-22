import { Card } from "@/components/ui/card";
import { asPercent, band, bandLabel } from "@/lib/report/score";
import { BAND_BG, BAND_TEXT, formatScore } from "./score-tokens";

interface VerdictHeroProps {
  readonly score: number;
  readonly headline: string;
  readonly answerCount: number;
}

/** The one thing to take away, before any of the detail underneath it. */
export function VerdictHero({
  score,
  headline,
  answerCount,
}: VerdictHeroProps) {
  // Band off the unrounded score: a 3.24 displayed as "3.2" is still a
  // leaning hire, and rounding first would promote it.
  const verdict = band(score);

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Overall
          </p>
          <p
            className={`text-2xl font-semibold tracking-tight ${BAND_TEXT[verdict]}`}
          >
            {bandLabel(verdict)}
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {headline}
          </p>
        </div>

        <div className="shrink-0 sm:w-48 sm:text-right">
          <p className="flex items-baseline gap-1 sm:justify-end">
            <span
              className={`text-5xl font-semibold tabular-nums tracking-tight ${BAND_TEXT[verdict]}`}
            >
              {formatScore(score)}
            </span>
            <span className="text-lg text-muted-foreground">/ 4</span>
          </p>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
            role="presentation"
          >
            <div
              className={`h-full rounded-full ${BAND_BG[verdict]}`}
              style={{ width: `${asPercent(score)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {answerCount} {answerCount === 1 ? "answer" : "answers"} scored
          </p>
        </div>
      </div>
    </Card>
  );
}
