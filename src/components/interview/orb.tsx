import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrbState } from "@/lib/voice/machine";

/**
 * The interviewer's avatar: three concentric circles that say whose turn it is
 * by colour, and by nothing else.
 *
 * Black while the interviewer is talking, green while it is the user's turn,
 * grey when it is neither. It does not throb, ping, breathe or swell.
 *
 * That is a deliberate reduction — see
 * [21](../../../docs/adr/0021-the-avatar-is-two-colours.md). The animated
 * version was driven by word-boundary events from `speechSynthesis` and by a
 * second microphone stream feeding an `AnalyserNode`, which made the avatar the
 * most complicated thing on the screen and, because both signals are
 * unreliable on Chrome's network voices, an unreliable read on what was
 * actually happening. Colour alone cannot go out of step with the state
 * machine, because there is nothing else for it to be out of step with.
 *
 * A colour transition is kept: the hand-over is worth seeing, and it is driven
 * by the state change itself rather than by a signal that has to be sampled.
 */
export function Orb({ state }: { state: OrbState }) {
  return (
    <div className="relative flex size-40 items-center justify-center">
      <span
        className={cn(
          "absolute inset-0 rounded-full transition-colors duration-500",
          state === "speaking" && "bg-primary/20",
          state === "listening" && "bg-success/20",
        )}
      />
      <span
        className={cn(
          "absolute inset-4 rounded-full transition-colors duration-500",
          state === "idle" && "bg-muted",
          state === "speaking" && "bg-primary/30",
          state === "listening" && "bg-success/30",
        )}
      />
      <span
        className={cn(
          "relative flex size-24 items-center justify-center rounded-full shadow-lg transition-colors duration-500",
          state === "idle" && "bg-muted",
          state === "speaking" && "bg-primary",
          state === "listening" && "bg-success",
        )}
      >
        <Mic
          className={cn(
            "size-8 transition-colors duration-300",
            state === "idle" ? "text-muted-foreground" : "text-white",
          )}
        />
      </span>
    </div>
  );
}
