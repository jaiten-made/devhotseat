import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A square box that fills with ink when ticked.
 *
 * Greyscale, like every other control that is not reporting a judgement: a
 * ticked question is a choice, not a verdict, so this is the same ink as the
 * text beside it rather than an accent colour. See
 * [27](../../../docs/adr/0027-greyscale-with-colour-reserved-for-judgements.md).
 *
 * `indeterminate` draws a dash instead of a tick, which is what a select-all
 * shows when only some of the list is picked.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-rule-strong bg-sheet shadow-xs transition-shadow outline-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-paper",
        "data-[state=indeterminate]:border-ink data-[state=indeterminate]:bg-ink data-[state=indeterminate]:text-paper",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        {props.checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
