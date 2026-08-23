import { Marker, Panel } from "@/components/ui/page";
import { PILLARS } from "@/lib/report/rubric";
import type { TurnAssessment } from "@/lib/report/schema";
import { scoresOf, turnScore } from "@/lib/report/score";
import { ScoreGauge, ScoreValue } from "./score-gauge";
import { formatScore, SCORE_TEXT } from "./score-tokens";

interface TurnCardProps {
  readonly assessment: TurnAssessment;
  readonly questionText: string;
}

/**
 * One answer, its five pillar scores, and the evidence behind them.
 *
 * Numbered, unlike the rows of the question bank: the turns of a session are a
 * sequence, asked in this order, and the number is how an answer is referred
 * to from the transcript further down the page.
 */
export function TurnCard({ assessment, questionText }: TurnCardProps) {
  const scores = scoresOf(assessment);
  const score = turnScore(scores);

  return (
    <Panel>
      <div className="flex items-start justify-between gap-5 border-b border-rule p-5">
        <div className="min-w-0 space-y-2">
          <Marker index={assessment.position} />
          <p className="font-medium leading-snug">{questionText}</p>
        </div>
        <div className="shrink-0 space-y-2 text-right">
          <ScoreValue value={formatScore(score)} />
          <ScoreGauge value={score} size="sm" className="ml-auto" />
        </div>
      </div>

      <div className="p-5">
        <ul className="mb-5 flex flex-wrap gap-1.5">
          {PILLARS.map((pillar) => (
            <li
              key={pillar.id}
              className="rounded bg-sunk px-2 py-1 font-mono text-[11px] tabular-nums"
            >
              <span className="sr-only">{pillar.label}</span>
              <span aria-hidden="true" className="text-ink-faint">
                {pillar.label.slice(0, 1)}
              </span>{" "}
              <span
                className={`font-semibold ${SCORE_TEXT[scores[pillar.id]]}`}
              >
                {scores[pillar.id]}
              </span>
            </li>
          ))}
        </ul>

        <dl className="space-y-3.5 text-sm">
          <div>
            <dt className="field-label">Strongest</dt>
            <dd className="mt-1 leading-relaxed">{assessment.strength}</dd>
          </div>
          <div>
            <dt className="field-label">Do differently</dt>
            <dd className="mt-1 leading-relaxed">{assessment.improvement}</dd>
          </div>
        </dl>

        {/*
          A native <details> rather than React state: five sentences per answer
          would triple the length of the page, and nothing else here is
          interactive.
        */}
        <details className="group mt-4 border-t border-rule pt-3">
          <summary className="field-label cursor-pointer list-none transition-colors hover:text-ink">
            <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">
              ▸
            </span>
            Why these scores
          </summary>
          <dl className="mt-3.5 space-y-3">
            {PILLARS.map((pillar) => (
              <div key={pillar.id} className="text-sm">
                <dt className="flex items-baseline gap-2 font-medium">
                  {pillar.label}
                  <span
                    className={`rounded bg-sunk px-1.5 font-mono text-[11px] font-semibold tabular-nums ${SCORE_TEXT[scores[pillar.id]]}`}
                  >
                    {scores[pillar.id]}
                  </span>
                </dt>
                <dd className="mt-0.5 leading-relaxed text-ink-muted">
                  {assessment[pillar.id].evidence}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </Panel>
  );
}
