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
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 text-left">
        <span className="block font-semibold leading-tight">{title}</span>
        {hint && (
          <span
            className={cn(
              "mt-0.5 block text-sm leading-snug",
              onClick
                ? "text-primary-foreground/80"
                : // The hint breathes while something is in flight, which is
                  // every state that is not yours to act in.
                  "animate-pulse text-muted-foreground",
              tone === "warning" &&
                (onClick ? "text-primary-foreground" : "text-warning"),
            )}
          >
            {hint}
          </span>
        )}
      </span>
    </>
  );

  const shape =
    "flex w-full max-w-md items-center gap-4 rounded-xl px-5 py-4 transition-colors";

  if (!onClick) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(shape, "border bg-muted/40 text-muted-foreground")}
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
        "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90",
      )}
    >
      {body}
    </button>
  );
}
