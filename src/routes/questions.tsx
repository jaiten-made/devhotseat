import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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
  Row,
  RowList,
} from "@/components/ui/page";
import { createQuestion, removeQuestion } from "@/fn/questions";
import { questionsQuery } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/questions")({
  component: QuestionBank,
});

/** The header's one number, so the size of the bank is stated without a row
 *  of it having to be counted. */
function bankCount(count: number): string {
  if (count === 0) return "Nothing in the bank";
  return `${count} ${count === 1 ? "question" : "questions"} in the bank`;
}

function QuestionBank() {
  const queryClient = useQueryClient();
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

  // The header is rendered in every branch, so the screen does not rebuild
  // itself around the content once the query lands.
  const header = (
    <PageHeader
      title="Question bank"
      // Only once the bank has landed. It sits beside the title rather than
      // above it, so arriving at the count adds nothing to the header's
      // height and the screen does not shuffle down when the query returns.
      meta={questions.isSuccess ? bankCount(questions.data.length) : undefined}
      actions={
        // Sessions are created from the sessions screen; this is a shortcut to
        // it, not a second way of doing it.
        questions.isSuccess && questions.data.length > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/sessions/new" data-testid="new-session">
              New session
            </Link>
          </Button>
        ) : undefined
      }
      description="Everything a session can draw on. Add as many as you like; which of them a session asks is picked when you start one."
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
            data-testid="question-input"
          />
          <Button
            type="submit"
            variant="outline"
            tone="success"
            className="text-ink-muted"
            disabled={text.trim() === "" || add.isPending}
            data-testid="add-question"
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
    </Page>
  );
}
