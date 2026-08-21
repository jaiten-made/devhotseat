import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export interface TranscriptTurn {
  readonly position: number;
  readonly questionText: string;
  readonly answerText: string | null;
}

/**
 * The answers given so far, in a drawer above the call bar. devprep's live
 * transcript: capped height, scrolled to the newest turn, and rendered as
 * alternating labelled blocks rather than chat bubbles.
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

  // Follow the newest turn while the drawer is open, and start at the bottom
  // when it is reopened. Nothing to follow until the first answer lands.
  useEffect(() => {
    if (!isOpen || answeredCount === 0) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [answeredCount, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="flex max-h-64 shrink-0 flex-col border-t bg-muted/40">
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
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
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
    </div>
  );
}
