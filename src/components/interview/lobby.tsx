import { Mic, Send, Volume2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * What the room shows before the interview has been started.
 *
 * The press that begins a session ([22](../../../docs/adr/0022-the-user-declares-their-turn.md))
 * left the stage holding a question nobody had asked yet: the first question
 * sat there in silence, read off the screen minutes before it would be spoken.
 * Practising an interview cold is the point, so the lobby withholds it.
 *
 * What it puts there instead is the briefing a real call opens with — how long
 * this will take, how the turns work, and that the microphone is about to be
 * asked for. The three steps carry the icons the turn bar uses for the same
 * moments, so the control at the bottom is already familiar the first time it
 * changes.
 *
 * No avatar: it reports whether the microphone is open, and in the lobby the
 * answer is "not yet, and not for any reason worth a warning icon".
 */
export function Lobby({ questionCount }: { questionCount: number }) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
      <span className="rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {questionCount} {questionCount === 1 ? "question" : "questions"}
      </span>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Ready when you are
        </h1>
        <p className="text-muted-foreground">
          You will be asked one question at a time, out loud, and you answer out
          loud. Nothing is asked until you start.
        </p>
      </div>

      <ol className="w-full space-y-4 rounded-xl border bg-muted/30 p-5 text-left">
        <Step icon={<Volume2 className="size-4" />} title="Listen">
          The interviewer reads the question aloud.
        </Step>
        <Step icon={<Mic className="size-4" />} title="Talk">
          Press the button below to open the microphone. You can cut in while
          the question is still being read.
        </Step>
        <Step icon={<Send className="size-4" />} title="Send">
          Press it again to hand your answer back and take the next question.
        </Step>
      </ol>

      <p className="text-xs text-muted-foreground">
        Your browser will ask to use the microphone. You can switch to typing at
        any time.
      </p>
    </div>
  );
}

function Step({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
        {icon}
      </span>
      <span className="text-sm leading-snug">
        <span className="block font-medium">{title}</span>
        <span className="text-muted-foreground">{children}</span>
      </span>
    </li>
  );
}
