import { Notice, Panel } from "@/components/ui/page";
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
 *
 * Every block is introduced by the same field label the rest of the app uses,
 * so the report reads as one document with named parts rather than a stack of
 * unrelated cards.
 */
export function ReportView({ report, turns }: ReportViewProps) {
  if (report.structured === null) {
    return (
      <div className="space-y-4">
        <CoachingNote content={report.content} />
        <Notice>Scored feedback isn’t available for this session.</Notice>
      </div>
    );
  }

  const { structured } = report;
  const scores = structured.turns.map(scoresOf);
  const overall = sessionScore(scores);
  const averages = pillarAverages(scores);
  const verdict = band(overall);

  return (
    <div className="space-y-4">
      <VerdictHero
        score={overall}
        headline={structured.headline}
        answerCount={structured.turns.length}
      />

      {/*
        The radar and the table are not the same fact twice: the shape says
        which pillars lag the others at a glance, the table says by how much.
      */}
      <Panel className="p-6">
        <p className="field-label">Pillar breakdown</p>
        <div className="mt-5 grid gap-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] md:items-center">
          <div className="flex justify-center">
            <PillarRadar averages={averages} verdict={verdict} />
          </div>
          <PillarBars averages={averages} />
        </div>
      </Panel>

      <CoachingNote content={report.content} />

      <section className="space-y-4 pt-2">
        <p className="field-label">Answer by answer</p>
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
      </section>
    </div>
  );
}
