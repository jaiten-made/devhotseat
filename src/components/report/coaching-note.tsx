/**
 * The prose half of the report. Also the whole of it when there is no rubric,
 * so nothing here clamps the height: reports written before scoring existed
 * run to about four hundred words.
 */
export function CoachingNote({ content }: { content: string }) {
  return (
    <article className="whitespace-pre-wrap rounded-lg border bg-card p-5 leading-relaxed">
      {content}
    </article>
  );
}
