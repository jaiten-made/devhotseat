import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SESSION_LENGTH } from "@/config";
import { createQuestion, removeQuestion } from "@/fn/questions";
import { startSession } from "@/fn/sessions";
import { questionsQuery } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/")({
  component: QuestionBank,
});

function QuestionBank() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // UI state only: the field being typed into.
  const [text, setText] = useState("");

  const questions = useQuery(questionsQuery());

  const add = useMutation({
    mutationFn: (value: string) => createQuestion({ data: { text: value } }),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: queryKeys.questions });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeQuestion({ data: { id } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.questions }),
  });

  const begin = useMutation({
    mutationFn: () => startSession(),
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

  if (questions.isPending) {
    return <p className="text-muted-foreground">Loading questions…</p>;
  }
  if (questions.isError) {
    return (
      <p className="text-destructive">
        Could not load the question bank: {questions.error.message}
      </p>
    );
  }

  const bank = questions.data;
  // SESSION_LENGTH is a maximum: one question is enough to start, and a
  // smaller bank simply gives a shorter session.
  const canStart = bank.length > 0;
  const upcomingLength = Math.min(SESSION_LENGTH, bank.length);

  return (
    <section>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Question bank
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        A session asks up to {SESSION_LENGTH} of these, picked at random.
      </p>

      <form
        className="mb-8 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim() !== "") add.mutate(text);
        }}
      >
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add an interview question…"
          aria-label="New question"
        />
        <Button type="submit" disabled={text.trim() === "" || add.isPending}>
          Add
        </Button>
      </form>

      {add.isError && (
        <p className="mb-4 text-sm text-destructive">
          Could not add that question: {add.error.message}
        </p>
      )}

      {bank.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No questions yet. Add your first one above.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {bank.map((question) => (
            <li key={question.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1">{question.text}</span>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete question: ${question.text}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(question.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 border-t pt-6">
        {canStart ? (
          <>
            <Button onClick={() => begin.mutate()} disabled={begin.isPending}>
              {begin.isPending ? "Starting…" : "Start a session"}
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">
              This session will ask {upcomingLength}{" "}
              {upcomingLength === 1 ? "question" : "questions"}.
            </p>
          </>
        ) : (
          <>
            <Button disabled>Start a session</Button>
            <p className="mt-2 text-sm text-muted-foreground">
              Add at least one question to start a session.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
