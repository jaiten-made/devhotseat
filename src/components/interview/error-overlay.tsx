import type { ReactNode } from "react";

/**
 * A failure shown in the middle of the room, under the avatar, with whatever
 * action can be taken about it. devprep put its retry here; this app's voice
 * failures are not retryable in place, so the action is usually the switch to
 * typing.
 */
export function ErrorOverlay({
  message,
  children,
}: {
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-3 text-center">
      <p className="text-sm text-destructive">{message}</p>
      {children}
    </div>
  );
}
