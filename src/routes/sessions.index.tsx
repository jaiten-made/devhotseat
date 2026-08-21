import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { sessionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/sessions/")({
  component: SessionList,
});

function SessionList() {
  const sessions = useQuery(sessionsQuery());

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
      <ul className="divide-y rounded-lg border">
        {sessions.data.map((session) => (
          <li key={session.id}>
            <Link
              to="/sessions/$sessionId"
              params={{ sessionId: session.id }}
              className="flex items-center gap-4 px-4 py-3 hover:bg-accent"
            >
              <span className="flex-1">
                {new Date(session.startedAt).toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                {session.answeredCount} of {session.questionCount} answered
              </span>
              <SessionStatus
                status={session.status}
                hasReport={session.hasReport}
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Colour carries the meaning here: green for a finished session with its
 * report, amber for one still running, and muted grey for a finished session
 * whose report never arrived — an absence rather than a failure.
 */
function SessionStatus({
  status,
  hasReport,
}: {
  status: "in_progress" | "completed";
  hasReport: boolean;
}) {
  if (status === "in_progress") {
    return <span className="text-sm text-warning">In progress</span>;
  }
  return hasReport ? (
    <span className="text-sm text-success">Report ready</span>
  ) : (
    <span className="text-sm text-muted-foreground">No report</span>
  );
}
