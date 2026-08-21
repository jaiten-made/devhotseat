import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mic, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { answerTurn } from "@/fn/sessions";
import { sessionQuery } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";
import {
  canSubmit,
  shouldListen,
  type VoiceEvent,
  type VoiceState,
  voiceTransition,
} from "@/lib/voice/machine";
import { useSpeechRecognition } from "@/lib/voice/use-speech-recognition";
import { useSpeechSupport } from "@/lib/voice/use-speech-support";
import { useSpeechSynthesis } from "@/lib/voice/use-speech-synthesis";

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

/** Shared by both input modes: one answer, then let server state advance. */
function useSubmitAnswer(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answer: string) =>
      answerTurn({ data: { id: sessionId, answer } }),
    // Invalidating the session is what produces the next question and the new
    // progress count. Nothing is tracked locally.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}

function currentQuestion(session: SessionDetail): string {
  return (
    session.turns.find((turn) => turn.position === session.currentPosition)
      ?.questionText ?? ""
  );
}

function Progress({ session }: { session: SessionDetail }) {
  return (
    <>
      <p className="mb-2 text-sm text-muted-foreground">
        Question {session.currentPosition} of {session.questionCount}
      </p>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {currentQuestion(session)}
      </h1>
    </>
  );
}

function LastQuestionNotice({ session }: { session: SessionDetail }) {
  if (session.currentPosition !== session.questionCount) return null;
  return (
    <p className="mt-4 text-sm text-warning">
      This is the last question. Submitting it ends the session and writes your
      feedback report.
    </p>
  );
}

/** Chooses between the spoken loop and typing, and lets you switch. */
function TurnLoop({ session }: { session: SessionDetail }) {
  const { supported } = useSpeechSupport();
  // UI state only: which input the user prefers this session.
  const [preferTyping, setPreferTyping] = useState(false);

  return supported && !preferTyping ? (
    <VoiceTurn session={session} onUseTyping={() => setPreferTyping(true)} />
  ) : (
    <TypedTurn
      session={session}
      onUseVoice={supported ? () => setPreferTyping(false) : null}
    />
  );
}

/** The spoken loop: the question is read aloud, then the microphone opens. */
function VoiceTurn({
  session,
  onUseTyping,
}: {
  session: SessionDetail;
  onUseTyping: () => void;
}) {
  const [voice, setVoice] = useState<VoiceState>({ status: "idle" });
  const send = useCallback(
    (event: VoiceEvent) => setVoice((state) => voiceTransition(state, event)),
    [],
  );

  const { speak, cancel } = useSpeechSynthesis();
  const recognition = useSpeechRecognition();
  const submit = useSubmitAnswer(session.id);

  const question = currentQuestion(session);
  const position = session.currentPosition;

  // Read each question once. Keyed on the turn so a re-render cannot start the
  // voice again half way through a sentence.
  const spokenForRef = useRef<number | null>(null);
  useEffect(() => {
    if (position === null || spokenForRef.current === position) return;
    spokenForRef.current = position;
    recognition.reset();
    send({ type: "ASK" });
    speak(question, () => send({ type: "SPOKEN" }));
  }, [position, question, speak, send, recognition.reset]);

  // The microphone is open in exactly one state, so mirror that here.
  const listening = shouldListen(voice);
  useEffect(() => {
    if (listening) recognition.start();
    else recognition.stop();
  }, [listening, recognition.start, recognition.stop]);

  // A refused microphone is not recoverable in place: offer typing instead.
  useEffect(() => {
    if (
      recognition.error === "not-allowed" ||
      recognition.error === "audio-capture"
    ) {
      send({ type: "MIC_BLOCKED", reason: recognition.error });
    }
  }, [recognition.error, send]);

  const handleSubmit = () => {
    // Read from refs, not React state, so the last committed words are included.
    const answer = recognition.getTranscript();
    if (answer.trim() === "") return;
    send({ type: "SUBMIT" });
    recognition.stop();
    cancel();
    submit.mutate(answer, {
      onSuccess: () => send({ type: "SUBMITTED" }),
      onError: () => send({ type: "SUBMIT_FAILED" }),
    });
  };

  if (voice.status === "blocked") {
    return (
      <section>
        <Progress session={session} />
        <p className="mb-4 rounded-lg border border-dashed border-warning/50 bg-warning/5 p-4 text-sm">
          The microphone is unavailable ({voice.reason}). Allow access and
          reload, or answer by typing.
        </p>
        <Button onClick={onUseTyping}>Type my answer instead</Button>
      </section>
    );
  }

  const status =
    voice.status === "speaking"
      ? "Reading the question…"
      : voice.status === "listening"
        ? "Listening…"
        : voice.status === "submitting"
          ? "Saving…"
          : "Getting ready…";

  return (
    <section>
      <Progress session={session} />

      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        {voice.status === "listening" ? (
          <Mic className="size-4 text-success" />
        ) : (
          <Volume2 className="size-4" />
        )}
        <span>{status}</span>
      </div>

      <p className="mb-6 min-h-24 rounded-lg border p-4 whitespace-pre-wrap">
        {recognition.getTranscript() || recognition.interimTranscript ? (
          <>
            {recognition.getTranscript()}
            {recognition.interimTranscript && (
              <span className="text-muted-foreground italic">
                {" "}
                {recognition.interimTranscript}
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">
            Your answer appears here as you speak.
          </span>
        )}
      </p>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit(voice) || submit.isPending}
        >
          {submit.isPending
            ? "Saving…"
            : session.currentPosition === session.questionCount
              ? "Submit final answer"
              : "Submit answer"}
        </Button>
        <Button
          variant="ghost"
          disabled={voice.status === "speaking" || submit.isPending}
          onClick={() => {
            // Re-reading goes back through the machine so the microphone is
            // closed first: an open mic would transcribe the app's own voice.
            send({ type: "ASK" });
            speak(question, () => send({ type: "SPOKEN" }));
          }}
        >
          Read again
        </Button>
        <Button variant="ghost" onClick={onUseTyping}>
          Type instead
        </Button>
      </div>

      {recognition.error && recognition.error !== "no-speech" && (
        <p className="mt-4 text-sm text-destructive">
          Microphone error: {recognition.error}
        </p>
      )}
      {submit.isError && (
        <p className="mt-4 text-sm text-destructive">
          Could not save that answer: {submit.error.message}
        </p>
      )}
      <LastQuestionNotice session={session} />
    </section>
  );
}

/** Typing: the fallback when speech is unsupported, refused, or unwanted. */
function TypedTurn({
  session,
  onUseVoice,
}: {
  session: SessionDetail;
  onUseVoice: (() => void) | null;
}) {
  // UI state only: the answer being typed.
  const [answer, setAnswer] = useState("");
  const submit = useSubmitAnswer(session.id);

  return (
    <section>
      <Progress session={session} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (answer.trim() === "") return;
          submit.mutate(answer, { onSuccess: () => setAnswer("") });
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
        <div className="flex items-center gap-3">
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
          {onUseVoice && (
            <Button type="button" variant="ghost" onClick={onUseVoice}>
              Answer by voice
            </Button>
          )}
        </div>
      </form>

      {submit.isError && (
        <p className="mt-4 text-sm text-destructive">
          Could not save that answer: {submit.error.message}
        </p>
      )}
      <LastQuestionNotice session={session} />
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
