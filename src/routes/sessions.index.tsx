import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  Notice,
  Page,
  PageHeader,
  Row,
  RowList,
} from "@/components/ui/page";
import { removeSession } from "@/fn/sessions";
import { sessionsQuery } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sessions/")({
  component: SessionList,
});

type SessionRow = Awaited<
  ReturnType<typeof import("@/fn/sessions").fetchSessions>
>[number];

function listEyebrow(count: number): string {
  if (count === 0) return "Nothing recorded";
  return `${count} ${count === 1 ? "session" : "sessions"}`;
}

function SessionList() {
  const queryClient = useQueryClient();
  const sessions = useQuery(sessionsQuery());

  const remove = useMutation({
    mutationFn: (id: string) => removeSession({ data: { id } }),
    // The `sessions` key nests over `session(id)`, so this drops the deleted
    // session's own cache entry along with the list.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });

  // Rendered in every branch, so a screen that is loading, broken or empty is
  // still recognisably this screen.
  const header = (
    <PageHeader
      eyebrow={
        sessions.isSuccess ? listEyebrow(sessions.data.length) : "Session log"
      }
      title="Sessions"
      description="Every interview you have practised, newest first. Open one to read its transcript and feedback."
    />
  );

  if (sessions.isPending) {
    return (
      <Page>
        {header}
        <Notice>Loading sessions…</Notice>
      </Page>
    );
  }
  if (sessions.isError) {
    return (
      <Page>
        {header}
        <Notice tone="destructive" role="alert">
          Could not load sessions: {sessions.error.message}
        </Notice>
      </Page>
    );
  }

  return (
    <Page>
      {header}

      <section className="space-y-4">
        {remove.isError && (
          <Notice tone="destructive" role="alert">
            Could not delete that session: {remove.error.message}
          </Notice>
        )}

        {sessions.data.length === 0 ? (
          <EmptyState>
            No sessions yet. Start one from the{" "}
            <Link
              to="/"
              className="font-medium text-ink underline underline-offset-4"
            >
              question bank
            </Link>
            .
          </EmptyState>
        ) : (
          <RowList>
            {sessions.data.map((session) => (
              <Row
                key={session.id}
                className="group transition-colors hover:bg-sunk"
              >
                {/* The row is the link, so the delete button sits outside it: a
                    button nested in an anchor is neither valid nor clickable. */}
                <Link
                  to="/sessions/$sessionId"
                  params={{ sessionId: session.id }}
                  className="flex flex-1 items-center gap-4 px-4 py-3.5"
                >
                  {/* Set in the data face so the column of timestamps lines up
                      digit for digit down the list. */}
                  <span className="flex-1 font-mono text-sm tabular-nums">
                    {new Date(session.startedAt).toLocaleString()}
                  </span>
                  <ReportState hasReport={session.hasReport} />
                </Link>
                <DeleteSession
                  session={session}
                  onConfirm={() => remove.mutate(session.id)}
                  disabled={remove.isPending}
                />
              </Row>
            ))}
          </RowList>
        )}
      </section>
    </Page>
  );
}

/**
 * Deleting a session takes the transcript and the report with it, so it asks
 * first, the way deleting a question does.
 *
 * The prompt names what actually goes, rather than a generic warning: how many
 * answers, and whether a report is among them.
 */
function DeleteSession({
  session,
  onConfirm,
  disabled,
}: {
  session: SessionRow;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const started = new Date(session.startedAt).toLocaleString();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          tone="destructive"
          className="mr-2 text-ink-faint"
          aria-label={`Delete session started ${started}`}
          disabled={disabled}
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this session?</AlertDialogTitle>
          <AlertDialogDescription>
            {describeLoss(session)} Your question bank is untouched. This cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function describeLoss(session: SessionRow): string {
  const answers =
    session.answeredCount === 1
      ? "1 answer"
      : `${session.answeredCount} answers`;
  return session.hasReport
    ? `Its transcript, ${answers} and feedback report will be deleted.`
    : `Its transcript and ${answers} will be deleted. It never had a report.`;
}

/**
 * Every session in this list has ended — leaving the room is what ends one —
 * so the only thing left to report is whether the report arrived.
 *
 * This was green for yes and grey for no. A report existing is a fact about
 * the pipeline rather than a judgement about the interview, and colour in this
 * app is reserved for judgements, so the two states are told apart by a filled
 * versus a hollow mark and by how dark the words are. Colour would also have
 * put a green pip on nearly every row of a list whose whole job is to be
 * skimmed.
 *
 * There was an amber "In progress" here once, for sessions nothing could end.
 * See [24](../../docs/adr/0024-leaving-the-room-ends-the-interview.md).
 */
function ReportState({ hasReport }: { hasReport: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em]",
        hasReport ? "text-ink" : "text-ink-faint",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          hasReport ? "bg-ink" : "border border-ink-faint",
        )}
      />
      {hasReport ? "Report ready" : "No report"}
    </span>
  );
}
