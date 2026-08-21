import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileText,
  Keyboard,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Volume2,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ControlButton,
  ErrorOverlay,
  Orb,
  TranscriptPanel,
} from "@/components/interview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { answerTurn } from "@/fn/sessions";
import { sessionQuery } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  canSubmit,
  describeSpeechError,
  type OrbState,
  orbStateFor,
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

function isLastQuestion(session: SessionDetail): boolean {
  return session.currentPosition === session.questionCount;
}

function submitLabel(session: SessionDetail): string {
  return isLastQuestion(session) ? "Submit final" : "Submit";
}

/**
 * The room the interview happens in, borrowed from devprep's meeting room: a
 * full-viewport column of header, stage, transcript drawer and call bar.
 *
 * It covers the app chrome for the duration of the call, the way devprep's
 * meeting room sits outside the sidebar layout. Fixed positioning rather than
 * a layout route keeps the change to this one screen.
 *
 * The room owns the two controls that mean the same thing whichever way the
 * answer is given — the transcript drawer and hanging up — and each input mode
 * supplies the ones in between.
 */
function Room({
  session,
  status,
  busy,
  children,
  controls,
}: {
  session: SessionDetail;
  status: string;
  /** Whether the status line should breathe, i.e. something is happening. */
  busy: boolean;
  children: ReactNode;
  controls: ReactNode;
}) {
  const navigate = useNavigate();
  const [showTranscript, setShowTranscript] = useState(false);
  const leave = () => navigate({ to: "/sessions" });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={leave}
          className="size-9 shrink-0"
          aria-label="Leave the session"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">
            Interview session
          </p>
          <p className="truncate text-sm text-muted-foreground">
            Question {session.currentPosition} of {session.questionCount}
          </p>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6">
        {children}
        <p
          className={cn(
            "text-sm text-muted-foreground",
            busy && "animate-pulse",
          )}
        >
          {status}
        </p>
      </main>

      <TranscriptPanel
        isOpen={showTranscript}
        onToggle={() => setShowTranscript((open) => !open)}
        turns={session.turns}
      />

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-4 border-t px-4 py-6 sm:gap-6">
        <ControlButton
          icon={<FileText className="size-5" />}
          label="Transcript"
          onClick={() => setShowTranscript((open) => !open)}
          active={showTranscript}
        />
        {controls}
        <ControlButton
          icon={<PhoneOff className="size-5" />}
          label="Leave"
          onClick={leave}
          destructive
        />
      </div>
    </div>
  );
}

/**
 * The question, and the last thing on the stage that is fixed for every mode.
 * Sized to be readable from a lean-back distance, since the point of the room
 * is that you are talking rather than reading.
 */
function Stage({
  session,
  orbState,
  children,
}: {
  session: SessionDetail;
  orbState: OrbState;
  children?: ReactNode;
}) {
  return (
    <>
      <Orb state={orbState} />
      <h1 className="max-w-xl text-balance text-center text-xl font-semibold tracking-tight">
        {currentQuestion(session)}
      </h1>
      {children}
      {isLastQuestion(session) && (
        <p className="max-w-sm text-center text-sm text-warning">
          This is the last question. Submitting it ends the session and writes
          your feedback report.
        </p>
      )}
    </>
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

  // These are not recoverable in place, so offer typing instead. `network`
  // is included because recognition is a hosted service that some browsers
  // ship without access to; retrying will not help.
  useEffect(() => {
    if (
      recognition.error === "not-allowed" ||
      recognition.error === "service-not-allowed" ||
      recognition.error === "audio-capture" ||
      recognition.error === "network"
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

  const readAgain = () => {
    // Re-reading goes back through the machine so the microphone is closed
    // first: an open mic would transcribe the app's own voice.
    send({ type: "ASK" });
    speak(question, () => send({ type: "SPOKEN" }));
  };

  // `no-speech` is retried silently by the hook, so it is not shown as a fault.
  const fault =
    recognition.error && recognition.error !== "no-speech"
      ? recognition.error
      : null;

  const status =
    voice.status === "speaking"
      ? "Reading the question…"
      : voice.status === "listening"
        ? "Listening…"
        : voice.status === "submitting"
          ? "Saving…"
          : "Getting ready…";

  // A blocked microphone ends the spoken loop for this turn: the stage keeps
  // the question on screen and the only way forward is typing.
  if (voice.status === "blocked") {
    return (
      <Room
        session={session}
        status="Microphone unavailable"
        busy={false}
        controls={
          <ControlButton
            icon={<Keyboard className="size-5" />}
            label="Type"
            onClick={onUseTyping}
            active
          />
        }
      >
        <Stage session={session} orbState="error">
          <ErrorOverlay message={describeSpeechError(voice.reason)}>
            <Button onClick={onUseTyping}>Type my answer instead</Button>
          </ErrorOverlay>
        </Stage>
      </Room>
    );
  }

  return (
    <Room
      session={session}
      status={status}
      busy={voice.status !== "idle"}
      controls={
        <>
          {/* Mirrors the microphone rather than driving it: the machine owns
              when it opens, so this is a light, not a switch. */}
          <ControlButton
            icon={
              recognition.isListening ? (
                <Mic className="size-5" />
              ) : (
                <MicOff className="size-5" />
              )
            }
            label={recognition.isListening ? "Listening" : "Mic off"}
            onClick={() => {}}
            disabled
            active={recognition.isListening}
          />
          <ControlButton
            icon={<Send className="size-5" />}
            label={submit.isPending ? "Saving…" : submitLabel(session)}
            onClick={handleSubmit}
            disabled={!canSubmit(voice) || submit.isPending}
            active={canSubmit(voice)}
          />
          <ControlButton
            icon={<Volume2 className="size-5" />}
            label="Read again"
            onClick={readAgain}
            disabled={voice.status === "speaking" || submit.isPending}
          />
          <ControlButton
            icon={<Keyboard className="size-5" />}
            label="Type"
            onClick={onUseTyping}
          />
        </>
      }
    >
      <Stage session={session} orbState={orbStateFor(voice, fault !== null)}>
        {/* Live captions: committed words plain, words still in flight italic. */}
        {canSubmit(voice) && (
          <p className="max-w-lg text-center text-sm">
            {recognition.finalTranscript || recognition.interimTranscript ? (
              <>
                <span className="text-foreground/70">
                  {recognition.finalTranscript}
                </span>
                {recognition.interimTranscript && (
                  <span className="italic text-muted-foreground">
                    {" "}
                    {recognition.interimTranscript}
                  </span>
                )}
              </>
            ) : (
              <span className="italic text-muted-foreground">
                Your answer appears here as you speak.
              </span>
            )}
          </p>
        )}

        {fault && (
          <p className="max-w-sm text-center text-sm text-destructive">
            {describeSpeechError(fault)}
          </p>
        )}
        {submit.isError && (
          <p className="max-w-sm text-center text-sm text-destructive">
            Could not save that answer: {submit.error.message}
          </p>
        )}
      </Stage>
    </Room>
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

  const handleSubmit = () => {
    if (answer.trim() === "" || submit.isPending) return;
    submit.mutate(answer, { onSuccess: () => setAnswer("") });
  };

  return (
    <Room
      session={session}
      status={submit.isPending ? "Saving…" : "Type your answer"}
      busy={submit.isPending}
      controls={
        <>
          <ControlButton
            icon={<Send className="size-5" />}
            label={submit.isPending ? "Saving…" : submitLabel(session)}
            onClick={handleSubmit}
            disabled={answer.trim() === "" || submit.isPending}
            active={answer.trim() !== ""}
          />
          {onUseVoice && (
            <ControlButton
              icon={<Mic className="size-5" />}
              label="Voice"
              onClick={onUseVoice}
            />
          )}
        </>
      }
    >
      {/* The avatar stays put so switching input modes does not change rooms,
          and still reports saving. */}
      <Stage
        session={session}
        orbState={submit.isPending ? "thinking" : "idle"}
      >
        <Textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Type your answer…"
          aria-label="Your answer"
          rows={6}
          className="max-w-lg"
        />
        {submit.isError && (
          <p className="max-w-sm text-center text-sm text-destructive">
            Could not save that answer: {submit.error.message}
          </p>
        )}
      </Stage>
    </Room>
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
