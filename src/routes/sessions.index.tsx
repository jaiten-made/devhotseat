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
              <span className="text-sm text-muted-foreground">
                {session.status === "in_progress"
                  ? "In progress"
                  : session.hasReport
                    ? "Report ready"
                    : "No report"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
