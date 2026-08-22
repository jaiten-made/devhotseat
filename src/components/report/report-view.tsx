import {
  band,
  pillarAverages,
  scoresOf,
  sessionScore,
} from "@/lib/report/score";
import type { SessionDetail } from "@/server/services/sessions";
import { CoachingNote } from "./coaching-note";
import { PillarBars } from "./pillar-bars";
import { PillarRadar } from "./pillar-radar";
import { TurnCard } from "./turn-card";
import { VerdictHero } from "./verdict-hero";

interface ReportViewProps {
  readonly report: NonNullable<SessionDetail["report"]>;
  readonly turns: SessionDetail["turns"];
}

/**
 * The report, in whichever of its three states applies.
 *
 * A report with no rubric is not an error — it is what a pre-scoring session
 * looks like, and what a model that wrote usable prose but unusable JSON
 * leaves behind. The prose alone is still worth reading, so it renders without
 * apology or charts.
 */
export function ReportView({ report, turns }: ReportViewProps) {
  if (report.structured === null) {
    return (
      <div className="space-y-3">
        <CoachingNote content={report.content} />
        <p className="text-sm text-muted-foreground">
          Scored feedback isn’t available for this session.
        </p>
      </div>
    );
  }

  const { structured } = report;
  const scores = structured.turns.map(scoresOf);
  const overall = sessionScore(scores);
  const averages = pillarAverages(scores);
  const verdict = band(overall);

  return (
    <div className="space-y-6">
      <VerdictHero
        score={overall}
        headline={structured.headline}
        answerCount={structured.turns.length}
      />

      <div className="grid gap-6 rounded-xl border bg-card p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
        <PillarRadar averages={averages} verdict={verdict} />
        <PillarBars averages={averages} />
      </div>

      <CoachingNote content={report.content} />

      <ol className="space-y-4">
        {structured.turns.map((assessment) => {
          // Joined by position rather than by index: a hand-written row could
          // score a turn that is not in the transcript, and mislabelling
          // someone's answer is worse than omitting it.
          const turn = turns.find(
            (candidate) => candidate.position === assessment.position,
          );
          if (!turn) return null;
          return (
            <li key={assessment.position}>
              <TurnCard
                assessment={assessment}
                questionText={turn.questionText}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
