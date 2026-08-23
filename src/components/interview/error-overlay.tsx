import type { ReactNode } from "react";

/**
 * A failure shown in the middle of the room, under the avatar, with whatever
 * action can be taken about it. devprep put its retry here; this app's voice
 * failures are not retryable in place, so the action is usually the switch to
 * typing.
 *
 * One of the few places colour survives the greyscale palette: something has
 * actually gone wrong, and the room around it is otherwise entirely neutral,
 * so the red carries on its own without needing to be loud.
 */
export function ErrorOverlay({
  message,
  children,
}: {
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-4 rounded-lg border border-destructive/25 bg-destructive/5 px-5 py-4 text-center">
      <p className="text-sm leading-relaxed text-destructive">{message}</p>
      {children}
    </div>
  );
}
