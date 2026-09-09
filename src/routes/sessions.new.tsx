import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  EmptyState,
  Notice,
  Page,
  PageHeader,
  Panel,
  Row,
  RowList,
} from "@/components/ui/page";
import { startSession } from "@/fn/sessions";
import { useAiPreference } from "@/lib/ai-preference";
import { questionsQuery } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/sessions/new")({
  component: NewSession,
});

/**
 * The list's one number: how much of the bank this sitting will cover.
 *
 * It sits on the list's own toolbar rather than beside the page title, because
 * it is the only figure on this screen that changes while you are reading it —
 * a tick two rows down moves it, and it should move where the eye already is.
 */
function pickedCount(picked: number, bank: number): string {
  if (picked === 0) return `None of ${bank} picked`;
  if (picked === bank) return `All ${bank} picked`;
  return `${picked} of ${bank} picked`;
}

function NewSession() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { effectiveProvider, effectiveModel, status } = useAiPreference();

  /**
   * Which questions are ticked, or null for "everything in the bank".
   *
   * Null rather than a set filled in once the query lands: the bank arrives
   * after the first render, and an untouched picker means the whole bank the
   * way starting a session used to. It also survives a question being deleted
   * in another tab, because the ids are only ever read through the bank below.
   */
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);

  const questions = useQuery(questionsQuery());

  const begin = useMutation({
    mutationFn: (questionIds: string[]) =>
      startSession({ data: { questionIds } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      if (result.ok && result.session) {
        navigate({
          to: "/sessions/$sessionId",
          params: { sessionId: result.session.id },
        });
      }
    },
  });

  const bank = questions.data ?? [];
  // The bank is the source of truth for what is ticked, so a question deleted
  // since the picker was drawn drops out of the session rather than being sent.
  const selectedIds = bank
    .filter((question) => picked === null || picked.has(question.id))
    .map((question) => question.id);
  const isPicked = (id: string) => picked === null || picked.has(id);

  const toggle = (id: string) => {
    setPicked((current) => {
      const next = new Set(current ?? bank.map((question) => question.id));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setAll = (all: boolean) =>
    setPicked(all ? new Set(bank.map((question) => question.id)) : new Set());

  // Rendered in every branch, so a screen that is loading, broken or empty is
  // still recognisably this screen.
  const header = (
    <PageHeader
      title="New session"
      description="Pick the questions this session should ask. They are asked one at a time, in random order."
    />
  );

  if (questions.isPending) {
    return (
      <Page>
        {header}
        <Notice>Loading questions…</Notice>
      </Page>
    );
  }
  if (questions.isError) {
    return (
      <Page>
        {header}
        <Notice tone="destructive" role="alert">
          Could not load the question bank: {questions.error.message}
        </Notice>
      </Page>
    );
  }

  if (bank.length === 0) {
    return (
      <Page>
        {header}
        <EmptyState>
          Nothing to ask yet. Add a question in the{" "}
          <Link
            to="/questions"
            className="font-medium text-ink underline underline-offset-4"
          >
            question bank
          </Link>{" "}
          first.
        </EmptyState>
      </Page>
    );
  }

  const allPicked = selectedIds.length === bank.length;
  const canStart = selectedIds.length > 0;

  return (
    <Page>
      {header}

      <section className="space-y-4">
        {begin.isError && (
          <Notice tone="destructive" role="alert">
            Could not start a session: {begin.error.message}
          </Notice>
        )}
        {/* The one refusal the server has: every question ticked was gone by
            the time it looked. */}
        {begin.data?.ok === false && (
          <Notice tone="warning" role="alert">
            Those questions are no longer in the bank. Pick again.
          </Notice>
        )}

        {/* No position markers on these rows: the bank is a set, and the order
            they are asked in is drawn fresh for every session. */}
        <RowList>
          {/* The list's toolbar: the one control that works on all of it, and
              the count of what is picked, on the rail above the rows it is
              counting. */}
          <Row className="gap-3 bg-sunk/60 px-4 py-3">
            <Checkbox
              id="pick-all"
              checked={
                allPicked
                  ? true
                  : selectedIds.length === 0
                    ? false
                    : "indeterminate"
              }
              onCheckedChange={() => setAll(!allPicked)}
              aria-label={
                allPicked ? "Clear every question" : "Pick every question"
              }
            />
            <label
              htmlFor="pick-all"
              className="field-label flex-1 cursor-pointer"
            >
              {allPicked ? "Clear all" : "Pick all"}
            </label>
            <p className="field-label" aria-live="polite">
              {pickedCount(selectedIds.length, bank.length)}
            </p>
          </Row>

          {bank.map((question) => (
            <Row
              key={question.id}
              className="gap-3 px-4 py-3 transition-colors hover:bg-sunk"
            >
              {/* Named on the box itself: the label beside it is what makes
                  the row clickable, but Radix's box is a button, and a button
                  takes its accessible name from itself. */}
              <Checkbox
                id={`pick-${question.id}`}
                checked={isPicked(question.id)}
                onCheckedChange={() => toggle(question.id)}
                aria-label={question.text}
              />
              {/* The whole row is the label, so the question text is as big a
                  target as the box itself. */}
              <label
                htmlFor={`pick-${question.id}`}
                className="flex-1 cursor-pointer leading-snug"
              >
                {question.text}
              </label>
            </Row>
          ))}
        </RowList>
      </section>

      {/* The one filled control on the screen, in a sheet of its own, the way
          the question bank used to carry it. */}
      <Panel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-ink-muted">
            {canStart ? (
              <>
                This session will ask {selectedIds.length}{" "}
                {selectedIds.length === 1 ? "question" : "questions"}.
              </>
            ) : (
              "Pick at least one question to start a session."
            )}
          </p>
          <p className="text-xs text-ink-faint font-mono">
            Scoring:{" "}
            {effectiveProvider === "local"
              ? `Local AI (${effectiveModel}${status?.local.isReachable === false ? " — offline" : ""})`
              : `Gemini (${effectiveModel})`}
          </p>
        </div>
        <Button
          size="lg"
          className="shrink-0"
          onClick={() => begin.mutate(selectedIds)}
          disabled={!canStart || begin.isPending}
          data-testid="start-session"
        >
          {begin.isPending ? "Starting…" : "Start a session"}
        </Button>
      </Panel>
    </Page>
  );
}
