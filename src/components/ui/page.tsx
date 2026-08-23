import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The layout vocabulary every screen is built from.
 *
 * Before this, each route invented its own rhythm: the question bank led with
 * a title and a description, the session list led with a title and nothing,
 * and the transcript led with a title and a date — each at a different margin,
 * so moving between them nudged the content up and down the page. Worse, the
 * loading and error branches returned a bare paragraph, dropping the heading
 * entirely, so every screen visibly rebuilt itself once its query landed.
 *
 * These are deliberately blunt: a header, a section, a panel, a row, an empty
 * state and a notice. A screen that needs something outside this set is
 * usually a screen that has drifted.
 */

/** A route's content column. Owns the spacing between its sections. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="space-y-10">{children}</div>;
}

/**
 * The top of a screen, in the same shape every time: what kind of screen this
 * is, what it is called, and what it is for. The eyebrow is the section of the
 * app you are standing in, which is also what the nav has highlighted — saying
 * it twice is what makes a full-viewport screen like the interview room, with
 * no nav to highlight, still feel like part of the app.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-rule pb-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="field-label">{eyebrow}</p>
          <h1 className="mt-2.5 text-[1.75rem] font-semibold leading-none">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ink-muted">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * A titled block within a screen. The title is set at body size rather than as
 * a smaller heading — the hierarchy is carried by the rule above it and the
 * space around it, so a section never competes with the page title.
 */
export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-rule pb-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-ink-muted">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** A sheet of paper: the default container for anything with an edge. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border border-rule bg-sheet", className)}>
      {children}
    </div>
  );
}

/** A ruled list inside a panel. One row height, everywhere in the app. */
export function RowList({ children }: { children: ReactNode }) {
  return (
    <Panel className="overflow-hidden">
      <ul className="divide-y divide-rule">{children}</ul>
    </Panel>
  );
}

export function Row({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <li className={cn("flex items-center", className)}>{children}</li>;
}

/**
 * An empty screen is an invitation, so it is set as a quiet sheet with the
 * next move in it rather than as a warning. Dashed, because the container is
 * describing a shape that has nothing in it yet.
 */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-rule-strong bg-sheet px-6 py-12 text-center text-sm text-ink-muted">
      {children}
    </div>
  );
}

/**
 * A line of status: loading, a failure, or something absent. One shape for all
 * three so a screen that is fetching, broken or empty is still recognisably
 * the same screen.
 */
export function Notice({
  tone = "muted",
  role,
  children,
}: {
  tone?: "muted" | "destructive" | "warning";
  role?: "alert" | "status";
  children: ReactNode;
}) {
  return (
    <p
      role={role}
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        tone === "muted" && "border-rule bg-sunk text-ink-muted",
        tone === "destructive" &&
          "border-destructive/25 bg-destructive/5 text-destructive",
        tone === "warning" && "border-warning/30 bg-warning/5 text-ink",
      )}
    >
      {children}
    </p>
  );
}

/**
 * A position in a sequence, set in the data face: `03 / 07`.
 *
 * Only sequences get one. A session's turns are a sequence — they were asked
 * in that order and the report refers back to it — so they are numbered. The
 * question bank is a set: it is asked in a random order every session, so
 * numbering its rows would be asserting an order that does not exist.
 */
export function Marker({ index, total }: { index: number; total?: number }) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    <span className="font-mono text-xs font-medium tabular-nums text-ink-faint">
      {pad(index)}
      {total !== undefined && (
        <>
          <span className="mx-0.5 text-ink-faint/60">/</span>
          {pad(total)}
        </>
      )}
    </span>
  );
}
