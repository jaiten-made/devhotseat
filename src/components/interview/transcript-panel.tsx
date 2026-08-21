import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

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
      className="absolute inset-y-0 right-0 z-10 flex w-80 max-w-[85%] shrink-0 flex-col border-l bg-background shadow-xl md:static md:max-w-none md:shadow-none"
    >
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium">Transcript</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-7 text-xs text-muted-foreground"
        >
          Hide
        </Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/40 px-4 py-3">
        {answeredCount === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No answers yet.
          </p>
        ) : (
          answered.flatMap((turn) => [
            <div key={`q-${turn.position}`} className="space-y-0.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Question {turn.position}
              </p>
              <p className="text-sm">{turn.questionText}</p>
            </div>,
            <div key={`a-${turn.position}`} className="space-y-0.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                You
              </p>
              <p className="whitespace-pre-wrap text-sm">{turn.answerText}</p>
            </div>,
          ])
        )}
        <div ref={endRef} />
      </div>
    </aside>
  );
}
