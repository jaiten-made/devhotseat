import { MAX_SCORE } from "@/lib/report/rubric";
import { cn } from "@/lib/utils";
import { SCORE_BG } from "./score-tokens";

const CELLS = [1, 2, 3, 4];

/**
 * One score, drawn the same way everywhere it appears.
 *
 * The report used to encode the same five numbers four different ways: a
 * radar, a segmented track, a round chip and a continuous meter. Only the
 * radar was doing a job the others could not — it shows the *shape* of a
 * candidate across the pillars, which no single number can. The rest were the
 * same fact in three costumes, so they collapse into this.
 *
 * Four cells rather than a smooth bar, because the underlying scale is four
 * whole numbers and a continuous bar would imply a precision the rubric does
 * not have. The last filled cell carries the fraction, so 3.4 reads as three
 * cells and a little.
 */
export function ScoreGauge({
  value,
  size = "md",
  className,
}: {
  value: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const rounded = Math.round(value);
  return (
    <div
      role="presentation"
      className={cn(
        "flex gap-0.5",
        size === "sm" ? "h-1.5 w-14" : "h-2 flex-1",
        className,
      )}
    >
      {CELLS.map((cell) => {
        const fill = Math.min(Math.max(value - (cell - 1), 0), 1);
        return (
          <div
            key={cell}
            className="flex-1 overflow-hidden rounded-[1px] bg-wash"
          >
            <div
              className={cn("h-full", SCORE_BG[rounded] ?? "bg-ink")}
              style={{ width: `${fill * 100}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** The score as a number, in the data face, with the scale it is out of. */
export function ScoreValue({
  value,
  size = "md",
  className,
}: {
  value: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono font-medium tabular-nums",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        size === "lg" && "text-[2.75rem] leading-none tracking-tight",
        className,
      )}
    >
      {value}
      {size === "lg" && (
        <span className="ml-1.5 align-baseline text-base font-normal text-ink-faint">
          {" "}
          / {MAX_SCORE}
        </span>
      )}
    </span>
  );
}
