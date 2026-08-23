import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Marker } from "@/components/ui/page";

export interface TranscriptTurn {
  readonly position: number;
  readonly questionText: string;
  readonly answerText: string | null;
}

/**
 * The answers given so far, in a panel down the right of the room. devprep's
 * live transcript: full height beside the stage, scrolled to the newest turn,
 * and rendered as alternating labelled blocks rather than chat bubbles.
 *
 * Wide enough for a column of prose and no wider, so the stage keeps the middle
 * of the room. Below `md` there is no room for two columns, so it slides over
 * the stage instead of squeezing it.
 *
 * It is set as a white sheet against the room's off-white, and its blocks
 * carry the same field labels and position markers the finished transcript
 * uses, so the live record and the one read afterwards are the same document.
 */
export function TranscriptPanel({
  isOpen,
  onToggle,
  turns,
}: {
  isOpen: boolean;
  onToggle: () => void;
  turns: readonly TranscriptTurn[];
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const answered = turns.filter((turn) => turn.answerText !== null);
  const answeredCount = answered.length;

  // Follow the newest turn while the panel is open, and start at the bottom
  // when it is reopened. Nothing to follow until the first answer lands.
  useEffect(() => {
    if (!isOpen || answeredCount === 0) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [answeredCount, isOpen]);

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Transcript"
      className="absolute inset-y-0 right-0 z-10 flex w-80 max-w-[85%] shrink-0 flex-col border-l border-rule bg-sheet shadow-xl md:static md:max-w-none md:shadow-none"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-rule px-4">
        <span className="field-label">Transcript</span>
        <Button
          variant="ghost"
          size="xs"
          onClick={onToggle}
          className="text-ink-muted hover:text-ink"
        >
          Hide
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {answeredCount === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-faint">
            No answers yet.
          </p>
        ) : (
          <ol className="divide-y divide-rule">
            {answered.map((turn) => (
              <li key={turn.position} className="space-y-3 px-4 py-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Marker index={turn.position} />
                    <span className="field-label">Question</span>
                  </div>
                  <p className="text-sm leading-snug">{turn.questionText}</p>
                </div>
                <div className="space-y-1.5 border-l-2 border-rule pl-3">
                  <span className="field-label">You</span>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                    {turn.answerText}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>
    </aside>
  );
}
