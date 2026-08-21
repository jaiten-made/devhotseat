import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { answerTurn } from "@/fn/sessions";
import { sessionQuery } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/sessions/$sessionId")({
  component: SessionView,
});

type SessionDetail = NonNullable<
  Awaited<ReturnType<typeof import("@/fn/sessions").fetchSession>>
>;

function SessionView() {
  const { sessionId } = Route.useParams();
  const session = useQuery(sessionQuery(sessionId));

  if (session.isPending) {
    return <p className="text-muted-foreground">Loading session…</p>;
  }
  if (session.isError) {
    return (
      <p className="text-destructive">
        Could not load this session: {session.error.message}
      </p>
    );
  }
  if (session.data === null) {
    return (
      <p className="text-muted-foreground">
        That session does not exist.{" "}
        <Link to="/sessions" className="underline">
          Back to sessions
        </Link>
        .
      </p>
    );
  }

  return session.data.status === "in_progress" ? (
    <TurnLoop session={session.data} />
  ) : (
    <Transcript session={session.data} />
  );
}

/** Milestone 7: one question at a time, progress read from server state. */
function TurnLoop({ session }: { session: SessionDetail }) {
  const queryClient = useQueryClient();
  // UI state only: the answer being typed.
  const [answer, setAnswer] = useState("");

  const submit = useMutation({
    mutationFn: (value: string) =>
      answerTurn({ data: { id: session.id, answer: value } }),
    onSuccess: () => {
      setAnswer("");
      // Invalidating the session is what produces the next question and the
      // new progress count. Nothing is tracked locally.
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });

  const current = session.turns.find(
    (turn) => turn.position === session.currentPosition,
  );

  return (
    <section>
      <p className="mb-2 text-sm text-muted-foreground">
        Question {session.currentPosition} of {session.questionCount}
      </p>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {current?.questionText}
      </h1>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (answer.trim() !== "") submit.mutate(answer);
        }}
      >
        <Textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Type your answer…"
          aria-label="Your answer"
          rows={8}
          className="mb-4"
        />
        <Button
          type="submit"
          disabled={answer.trim() === "" || submit.isPending}
        >
          {submit.isPending
            ? "Saving…"
            : session.currentPosition === session.questionCount
              ? "Submit final answer"
              : "Submit answer"}
        </Button>
      </form>

      {submit.isError && (
        <p className="mt-4 text-sm text-destructive">
          Could not save that answer: {submit.error.message}
        </p>
      )}
      {session.currentPosition === session.questionCount && (
        <p className="mt-4 text-sm text-warning">
          This is the last question. Submitting it ends the session and writes
          your feedback report.
        </p>
      )}
    </section>
  );
}

/** Milestone 8: the full Q&A exchange, and the report if one was written. */
function Transcript({ session }: { session: SessionDetail }) {
  return (
    <section>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Transcript</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {new Date(session.startedAt).toLocaleString()} · {session.answeredCount}{" "}
        of {session.questionCount} answered
      </p>

      <ol className="mb-10 space-y-6">
        {session.turns.map((turn) => (
          <li key={turn.position} className="rounded-lg border p-4">
            <p className="mb-2 font-medium">
              {turn.position}. {turn.questionText}
            </p>
            <p className="whitespace-pre-wrap text-muted-foreground">
              {turn.answerText ?? "(not answered)"}
            </p>
          </li>
        ))}
      </ol>

      <h2 className="mb-3 text-xl font-semibold tracking-tight">Feedback</h2>
      {session.report ? (
        <article className="whitespace-pre-wrap rounded-lg border bg-card p-5 leading-relaxed">
          {session.report.content}
        </article>
      ) : (
        // A missing report is a degraded state, not an error: the amber tint
        // says something is absent without claiming anything went wrong.
        <p className="rounded-lg border border-dashed border-warning/50 bg-warning/5 p-6">
          No report was written for this session. The transcript above is still
          complete.
        </p>
      )}
    </section>
  );
}
