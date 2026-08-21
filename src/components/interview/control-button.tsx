import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One round control on the call bar: a bordered circle with a caption under
 * it. devprep's meeting room shape — the caption is the button's accessible
 * name, so the icon needs no label of its own.
 */
export function ControlButton({
  icon,
  label,
  onClick,
  active = false,
  destructive = false,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex flex-col items-center gap-1.5",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-full border-2 transition-colors",
          destructive
            ? "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            : active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-foreground hover:bg-accent",
        )}
      >
        {icon}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}
