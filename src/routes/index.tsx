import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  EmptyState,
  Notice,
  Page,
  PageHeader,
  Panel,
  Row,
  RowList,
} from "@/components/ui/page";
import { createQuestion, removeQuestion } from "@/fn/questions";
import { startSession } from "@/fn/sessions";
import { questionsQuery } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/")({
  component: QuestionBank,
});

/** The eyebrow is the screen's one number, so the header states the size of
 *  the bank without a row of it having to be counted. */
function bankEyebrow(count: number): string {
  if (count === 0) return "Nothing in the bank";
  return `${count} ${count === 1 ? "question" : "questions"} in the bank`;
}

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

  // The header is rendered in every branch, so the screen does not rebuild
  // itself around the content once the query lands.
  const header = (
    <PageHeader
      eyebrow={
        questions.isSuccess
          ? bankEyebrow(questions.data.length)
          : "Question set"
      }
      title="Question bank"
      description="A session asks every question here, in random order. Add as many as you like."
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

  const bank = questions.data;
  // A session asks the whole bank, so one question is enough to start.
  const canStart = bank.length > 0;
  const upcomingLength = bank.length;

  return (
    <Page>
      {header}

      <section className="space-y-4">
        <form
          className="flex gap-2"
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
          <Button
            type="submit"
            variant="outline"
            tone="success"
            className="text-ink-muted"
            disabled={text.trim() === "" || add.isPending}
          >
            Add
          </Button>
        </form>

        {add.isError && (
          <Notice tone="destructive" role="alert">
            Could not add that question: {add.error.message}
          </Notice>
        )}

        {bank.length === 0 ? (
          <EmptyState>No questions yet. Add your first one above.</EmptyState>
        ) : (
          /* No position markers: the bank is a set, asked in a random order
             every session, so numbering the rows would assert an order that
             does not exist. */
          <RowList>
            {bank.map((question) => (
              <Row
                key={question.id}
                className="group gap-3 px-4 py-3 transition-colors hover:bg-sunk"
              >
                <span className="flex-1 leading-snug">{question.text}</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      tone="destructive"
                      className="text-ink-faint"
                      aria-label={`Delete question: ${question.text}`}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this question?</AlertDialogTitle>
                      <AlertDialogDescription>
                        “{question.text}” will be removed from the bank. Past
                        transcripts keep their own copy of the wording, so this
                        does not change any session you have already run.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => remove.mutate(question.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </Row>
            ))}
          </RowList>
        )}
      </section>

      {/*
        The one filled control on the screen, in a sheet of its own. Adding a
        question is incidental beside starting the session the questions are
        for, so "Add" is outlined and this is not.
      */}
      <Panel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          {canStart ? (
            <>
              This session will ask {upcomingLength}{" "}
              {upcomingLength === 1 ? "question" : "questions"}.
            </>
          ) : (
            "Add at least one question to start a session."
          )}
        </p>
        <Button
          size="lg"
          className="shrink-0"
          onClick={() => begin.mutate()}
          disabled={!canStart || begin.isPending}
        >
          {begin.isPending ? "Starting…" : "Start a session"}
        </Button>
      </Panel>
    </Page>
  );
}
