import { Mic } from "lucide-react";
import { type Ref, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { OrbState } from "@/lib/voice/machine";

/** Tailwind's own ping easing, so the two paths look like one animation. */
const PING_EASING = "cubic-bezier(0, 0, 0.2, 1)";

/** One word's throb, short enough not to run into the next word. */
const WORD_MS = 420;

/**
 * The interviewer's avatar, carried over from devprep's meeting room: three
 * concentric circles that breathe.
 *
 * Two things drive it, and both are the real audio rather than a fixed clock:
 *
 * - While the question is read, `pulse` ticks once per spoken word and the
 *   halo throbs on each tick. Until the first tick arrives the halo falls back
 *   to a steady ping, because not every voice reports word boundaries and a
 *   still avatar would read as a hung app.
 * - While listening, `--mic-level` swells the rings with how loudly you are
 *   actually speaking. `useMicLevel` writes it to the element this `ref`
 *   lands on.
 */
export function Orb({
  state,
  pulse = 0,
  ref,
}: {
  state: OrbState;
  /** Increments once per spoken word. 0 means none have been reported. */
  pulse?: number;
  ref?: Ref<HTMLDivElement>;
}) {
  const haloRef = useRef<HTMLSpanElement>(null);
  const resting = state === "idle" || state === "thinking";
  const live = state === "speaking" || state === "listening";
  // Word boundaries are all-or-nothing per voice, so one tick is enough to
  // know this engine reports them and the steady ping can stand down.
  const wordDriven = pulse > 0;

  useEffect(() => {
    if (pulse === 0) return;
    haloRef.current?.animate(
      [
        { transform: "scale(0.9)", opacity: 0.5 },
        { transform: "scale(1.7)", opacity: 0 },
      ],
      { duration: WORD_MS, easing: PING_EASING },
    );
  }, [pulse]);

  // Louder speech pushes the rings out. The middle ring travels further than
  // the core so the movement reads as breathing rather than as a jolt.
  const swell = (factor: number) =>
    state === "listening"
      ? { transform: `scale(calc(1 + var(--mic-level, 0) * ${factor}))` }
      : undefined;

  return (
    <div
      ref={ref}
      className="relative flex size-40 items-center justify-center"
    >
      <span
        ref={haloRef}
        className={cn(
          "absolute inset-0 rounded-full",
          state === "speaking" && "bg-primary/20",
          state === "speaking" && !wordDriven && "animate-ping",
        )}
      />
      <span
        style={swell(0.3)}
        className={cn(
          "absolute inset-4 rounded-full transition-colors duration-500",
          state === "idle" && "bg-muted",
          state === "thinking" && "animate-pulse bg-muted",
          state === "speaking" && "animate-pulse bg-primary/30",
          // The pulse stays under the swell: if the second microphone stream
          // is refused, --mic-level never moves and this is all the life the
          // ring has.
          state === "listening" && "animate-pulse bg-success/30",
          state === "error" && "bg-destructive/20",
        )}
      />
      <span
        style={swell(0.12)}
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
