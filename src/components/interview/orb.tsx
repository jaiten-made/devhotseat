import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The interviewer's avatar: three concentric circles reporting one thing,
 * whether the microphone is open.
 *
 * It takes the same boolean that opens the microphone rather than a look
 * derived from the voice state, so the two cannot fall out of step — there is
 * nothing for them to disagree about. An earlier version coloured itself by
 * whose turn it was, which read well but rested on knowing when the voice had
 * stopped, and `speechSynthesis` cannot tell you that. Reporting the
 * microphone is a fact the app owns. See
 * [22](../../../docs/adr/0022-the-user-declares-their-turn.md).
 *
 * It reported it in green until the palette went greyscale. Green here was the
 * largest field of colour in the app, sat in the middle of the one screen
 * meant to be calm, and said nothing the icon inside it was not already
 * saying. Ink says it instead: solid and dark while the microphone is open,
 * drawn as an outline on paper while it is shut. See
 * [27](../../../docs/adr/0027-greyscale-with-colour-reserved-for-judgements.md).
 *
 * It does not throb, ping, breathe or swell —
 * [21](0021-the-avatar-is-two-colours.md) still holds for everything except
 * what the two looks are made of.
 */
export function Orb({ listening }: { listening: boolean }) {
  return (
    <div className="relative flex size-40 items-center justify-center">
      <span
        className={cn(
          "absolute inset-0 rounded-full transition-colors duration-500",
          listening ? "bg-ink/[0.06]" : "bg-transparent",
        )}
      />
      <span
        className={cn(
          "absolute inset-4 rounded-full transition-colors duration-500",
          listening ? "bg-ink/[0.12]" : "bg-wash",
        )}
      />
      <span
        className={cn(
          "relative flex size-24 items-center justify-center rounded-full border transition-colors duration-500",
          listening ? "border-ink bg-ink" : "border-rule-strong bg-sheet",
        )}
      >
        {listening ? (
          <Mic className="size-8 text-paper transition-colors duration-300" />
        ) : (
          <MicOff className="size-8 text-ink-faint transition-colors duration-300" />
        )}
      </span>
    </div>
  );
}
