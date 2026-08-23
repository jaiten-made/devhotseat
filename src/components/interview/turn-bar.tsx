import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one control at the bottom of the room, naming whose turn it is.
 *
 * A row of equal round buttons could not say which of them moved the
 * conversation on, so the turn itself became the control: it is a `button` only
 * when the move is yours, and a status region in every other state. Nothing
 * else in the room is a filled control, so there is never a question of what to
 * press next.
 *
 * The two states are now told apart by more than a fill. Yours is solid ink on
 * paper and sits proud of the page; the interviewer's is a sunk, ruled well
 * with the icon in outline. Pressability is legible without relying on the one
 * colour a greyscale app has left.
 */
export function TurnBar({
  icon,
  title,
  hint,
  tone = "default",
  onClick,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  /** `warning` tints the hint, for the last question ending the session. */
  tone?: "default" | "warning";
  /** Omitted when the move is not yours: renders the status region instead. */
  onClick?: () => void;
}) {
  const body = (
    <>
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-md",
          onClick ? "bg-paper/15" : "bg-sheet border border-rule",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 text-left">
        <span className="block font-semibold leading-tight">{title}</span>
        {hint && (
          <span
            className={cn(
              "mt-1 block text-sm leading-snug",
              onClick
                ? "text-paper/70"
                : // The hint breathes while something is in flight, which is
                  // every state that is not yours to act in.
                  "animate-pulse text-ink-muted",
              tone === "warning" && (onClick ? "text-paper" : "text-warning"),
            )}
          >
            {hint}
          </span>
        )}
      </span>
    </>
  );

  const shape =
    "flex w-full max-w-md items-center gap-4 rounded-lg px-4 py-3.5 transition-colors";

  if (!onClick) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(shape, "border border-rule bg-sunk text-ink-muted")}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        shape,
        "bg-ink text-paper shadow-sm hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
      )}
    >
      {body}
    </button>
  );
}
