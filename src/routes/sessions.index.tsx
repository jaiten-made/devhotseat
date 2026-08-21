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
import { removeSession } from "@/fn/sessions";
import { sessionsQuery } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/sessions/")({
  component: SessionList,
});

type SessionRow = Awaited<
  ReturnType<typeof import("@/fn/sessions").fetchSessions>
>[number];

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

  if (sessions.isPending) {
    return <p className="text-muted-foreground">Loading sessions…</p>;
  }
  if (sessions.isError) {
    return (
      <p className="text-destructive">
        Could not load sessions: {sessions.error.message}
      </p>
    );
  }

  if (sessions.data.length === 0) {
    return (
      <section>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Sessions</h1>
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No sessions yet. Start one from the{" "}
          <Link to="/" className="underline">
            question bank
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Sessions</h1>

      {remove.isError && (
        <p className="mb-4 text-sm text-destructive">
          Could not delete that session: {remove.error.message}
        </p>
      )}

      <ul className="divide-y rounded-lg border">
        {sessions.data.map((session) => (
          <li key={session.id} className="flex items-center">
            {/* The row is the link, so the delete button sits outside it: a
                button nested in an anchor is neither valid nor clickable. */}
            <Link
              to="/sessions/$sessionId"
              params={{ sessionId: session.id }}
              className="flex flex-1 items-center gap-4 px-4 py-3 hover:bg-accent"
            >
              <span className="flex-1">
                {new Date(session.startedAt).toLocaleString()}
              </span>
              <ReportState hasReport={session.hasReport} />
            </Link>
            <DeleteSession
              session={session}
              onConfirm={() => remove.mutate(session.id)}
              disabled={remove.isPending}
            />
          </li>
        ))}
      </ul>
    </section>
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
          size="icon"
          className="mr-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
 * so the only thing left to report is whether the report arrived. Green for
 * yes, muted grey for no: an absence rather than a failure.
 *
 * There was an amber "In progress" here once, for sessions nothing could end.
 * See [24](../../docs/adr/0024-leaving-the-room-ends-the-interview.md).
 */
function ReportState({ hasReport }: { hasReport: boolean }) {
  return hasReport ? (
    <span className="text-sm text-success">Report ready</span>
  ) : (
    <span className="text-sm text-muted-foreground">No report</span>
  );
}
