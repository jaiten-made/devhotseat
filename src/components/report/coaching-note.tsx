import { Panel } from "@/components/ui/page";

/**
 * The prose half of the report. Also the whole of it when there is no rubric,
 * so nothing here clamps the height: reports written before scoring existed
 * run to about four hundred words.
 *
 * Set at a slightly narrower measure and looser leading than the rest of the
 * app. It is the only long-form reading on any screen, and the only thing the
 * interviewer wrote in sentences rather than numbers.
 */
export function CoachingNote({ content }: { content: string }) {
  return (
    <Panel className="p-6">
      <p className="field-label">Coaching note</p>
      <article className="mt-3 max-w-[62ch] whitespace-pre-wrap text-[0.9375rem] leading-[1.75]">
        {content}
      </article>
    </Panel>
  );
}
