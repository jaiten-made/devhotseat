import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui's class merge helper: conditional classes, last Tailwind wins. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
