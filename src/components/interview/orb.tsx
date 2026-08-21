import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The interviewer's avatar: three concentric circles reporting one thing,
 * whether the microphone is open. Green when it is, grey when it is not.
 *
 * It takes the same boolean that opens the microphone rather than a look
 * derived from the voice state, so the two cannot fall out of step — there is
 * nothing for them to disagree about. An earlier version coloured itself by
 * whose turn it was, which read well but rested on knowing when the voice had
 * stopped, and `speechSynthesis` cannot tell you that. Reporting the
 * microphone is a fact the app owns. See
 * [22](../../../docs/adr/0022-the-user-declares-their-turn.md).
 *
 * It does not throb, ping, breathe or swell —
 * [21](0021-the-avatar-is-two-colours.md) still holds for everything except
 * what the colours mean.
 */
export function Orb({ listening }: { listening: boolean }) {
  return (
    <div className="relative flex size-40 items-center justify-center">
      <span
        className={cn(
          "absolute inset-0 rounded-full transition-colors duration-500",
          listening && "bg-success/20",
        )}
      />
      <span
        className={cn(
          "absolute inset-4 rounded-full transition-colors duration-500",
          listening ? "bg-success/30" : "bg-muted",
        )}
      />
      <span
        className={cn(
          "relative flex size-24 items-center justify-center rounded-full shadow-lg transition-colors duration-500",
          listening ? "bg-success" : "bg-muted",
        )}
      >
        {listening ? (
          <Mic className="size-8 text-white transition-colors duration-300" />
        ) : (
          <MicOff className="size-8 text-muted-foreground transition-colors duration-300" />
        )}
      </span>
    </div>
  );
}
