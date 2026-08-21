import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrbState } from "@/lib/voice/machine";

/**
 * The interviewer's avatar, carried over from devprep's meeting room: three
 * concentric circles that breathe.
 *
 * The outer halo only expands while the question is being read, so "it is
 * talking" is legible from across the room. The middle ring pulses in every
 * live state, and the core carries the colour: neutral while waiting, dark
 * while speaking, green while the microphone is open.
 */
export function Orb({ state }: { state: OrbState }) {
  const resting = state === "idle" || state === "thinking";
  const live = state === "speaking" || state === "listening";

  return (
    <div className="relative flex size-40 items-center justify-center">
      <span
        className={cn(
          "absolute inset-0 rounded-full",
          state === "speaking" && "animate-ping bg-primary/20",
        )}
      />
      <span
        className={cn(
          "absolute inset-4 rounded-full transition-colors duration-500",
          state === "idle" && "bg-muted",
          state === "thinking" && "animate-pulse bg-muted",
          state === "speaking" && "animate-pulse bg-primary/30",
          state === "listening" && "animate-pulse bg-success/30",
          state === "error" && "bg-destructive/20",
        )}
      />
      <span
        className={cn(
          "relative flex size-24 items-center justify-center rounded-full shadow-lg transition-colors duration-500",
          resting && "bg-muted",
          state === "speaking" && "bg-primary",
          state === "listening" && "bg-success",
          state === "error" && "bg-destructive/50",
        )}
      >
        <Mic
          className={cn(
            "size-8 transition-colors duration-300",
            live ? "text-white" : "text-muted-foreground",
          )}
        />
      </span>
    </div>
  );
}
