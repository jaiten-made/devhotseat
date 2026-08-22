import { Card } from "@/components/ui/card";
import { PILLARS } from "@/lib/report/rubric";
import type { TurnAssessment } from "@/lib/report/schema";
import { scoresOf, turnScore } from "@/lib/report/score";
import { formatScore, SCORE_CHIP } from "./score-tokens";

interface TurnCardProps {
  readonly assessment: TurnAssessment;
  readonly questionText: string;
}

/** One answer, its five pillar scores, and the evidence behind them. */
export function TurnCard({ assessment, questionText }: TurnCardProps) {
  const scores = scoresOf(assessment);
  const score = turnScore(scores);

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-start justify-between gap-4 border-b p-5">
        <p className="font-medium leading-snug">
          {assessment.position}. {questionText}
        </p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${SCORE_CHIP[Math.round(score)]}`}
        >
          {formatScore(score)}
        </span>
      </div>

      <div className="p-5">
        <ul className="mb-5 flex flex-wrap gap-2">
          {PILLARS.map((pillar) => (
            <li
              key={pillar.id}
              className={`rounded-md px-2 py-1 text-xs font-medium ${SCORE_CHIP[scores[pillar.id]]}`}
            >
              <span className="sr-only">{pillar.label}</span>
              <span aria-hidden="true">{pillar.label.slice(0, 1)}</span>{" "}
              {scores[pillar.id]}
            </li>
          ))}
        </ul>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Strongest
            </dt>
            <dd className="mt-0.5 leading-relaxed">{assessment.strength}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Do differently
            </dt>
            <dd className="mt-0.5 leading-relaxed">{assessment.improvement}</dd>
          </div>
        </dl>

        {/*
          A native <details> rather than React state: five sentences per answer
          would triple the length of the page, and nothing else here is
          interactive.
        */}
        <details className="mt-4 border-t pt-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Why these scores
          </summary>
          <dl className="mt-3 space-y-2.5">
            {PILLARS.map((pillar) => (
              <div key={pillar.id} className="text-sm">
                <dt className="flex items-baseline gap-2 font-medium">
                  {pillar.label}
                  <span
                    className={`rounded px-1.5 text-xs tabular-nums ${SCORE_CHIP[scores[pillar.id]]}`}
                  >
                    {scores[pillar.id]}
                  </span>
                </dt>
                <dd className="mt-0.5 leading-relaxed text-muted-foreground">
                  {assessment[pillar.id].evidence}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </Card>
  );
}
