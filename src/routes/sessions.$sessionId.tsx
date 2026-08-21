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
  type ComponentProps,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ErrorOverlay,
  Orb,
  TranscriptPanel,
  TurnBar,
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
import { useMicLevel } from "@/lib/voice/use-mic-level";
import { useSpeechRecognition } from "@/lib/voice/use-speech-recognition";
import { useSpeechSupport } from "@/lib/voice/use-speech-support";
import { useSpeechSynthesis } from "@/lib/voice/use-speech-synthesis";

export const Route = createFileRoute("/sessions/$sessionId")({
  component: SessionView,
});

type SessionDetail = NonNullable<
  Awaited<ReturnType<typeof import("@/fn/sessions").fetchSession>>
>;

type TurnBarProps = ComponentProps<typeof TurnBar>;

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

/**
 * The room the interview happens in, borrowed from devprep's meeting room: a
 * full-viewport column of header, stage, transcript drawer and turn control.
 *
 * It covers the app chrome for the duration of the call, the way devprep's
 * meeting room sits outside the sidebar layout. Fixed positioning rather than
 * a layout route keeps the change to this one screen.
 *
 * The bottom of the room is one wide `TurnBar` naming whose move it is, and
 * under it the incidentals as plain ghost buttons. Only the bar is ever filled,
 * so the thing that moves the conversation on cannot be mistaken for the thing
 * that opens a drawer. Hanging up lives in the header for the same reason.
 */
function Room({
  session,
  turn,
  secondaries,
  children,
}: {
  session: SessionDetail;
  /** Whose turn it is, and the move if it is yours. */
  turn: TurnBarProps;
  /** The incidentals this input mode adds beside the transcript toggle. */
  secondaries: ReactNode;
  children: ReactNode;
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
        <Button
          variant="ghost"
          size="sm"
          onClick={leave}
          className="shrink-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <PhoneOff className="size-4" />
          Leave
        </Button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6">
        {children}
      </main>

      <TranscriptPanel
        isOpen={showTranscript}
        onToggle={() => setShowTranscript((open) => !open)}
        turns={session.turns}
      />

      <div className="flex shrink-0 flex-col items-center gap-3 border-t px-4 py-5">
        <TurnBar {...turn} />
        <div className="flex flex-wrap items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTranscript((open) => !open)}
            className={cn(
              "text-muted-foreground",
              showTranscript && "bg-accent text-accent-foreground",
            )}
          >
            <FileText className="size-4" />
            Transcript
          </Button>
          {secondaries}
        </div>
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
  orbPulse,
  orbRef,
  children,
}: {
  session: SessionDetail;
  orbState: OrbState;
  /** Ticks once per spoken word; see `Orb`. */
  orbPulse?: number;
  orbRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}) {
  return (
    <>
      <Orb state={orbState} pulse={orbPulse} ref={orbRef} />
      <h1 className="max-w-xl text-balance text-center text-xl font-semibold tracking-tight">
        {currentQuestion(session)}
      </h1>
      {children}
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

/**
 * The voice loop as the turn control sees it. Pressable in exactly one case:
 * the microphone is open *and* something has been heard, so the bar is never
 * offering a hand-over that would be thrown away as empty.
 */
function voiceTurnBar(
  session: SessionDetail,
  voice: VoiceState,
  hasWords: boolean,
  onSubmit: () => void,
): TurnBarProps {
  switch (voice.status) {
    case "speaking":
      return {
        icon: <Volume2 className="size-6" />,
        title: "Interviewer's turn",
        hint: "Reading the question aloud…",
      };
    case "listening":
      if (!hasWords) {
        return {
          icon: <Mic className="size-6 animate-pulse" />,
          title: "Your turn",
          hint: "Start speaking — your words appear above.",
        };
      }
      return isLastQuestion(session)
        ? {
            icon: <Mic className="size-6" />,
            title: "Your turn",
            hint: "Tap when you have finished. This ends the session and writes your feedback report.",
            tone: "warning",
            onClick: onSubmit,
          }
        : {
            icon: <Mic className="size-6" />,
            title: "Your turn",
            hint: "Tap when you have finished answering.",
            onClick: onSubmit,
          };
    case "submitting":
      return {
        icon: <Send className="size-6" />,
        title: "Saving your answer…",
        hint: "Handing back to the interviewer.",
      };
    case "blocked":
      return {
        icon: <MicOff className="size-6" />,
        title: "Microphone unavailable",
        hint: describeSpeechError(voice.reason),
      };
    default:
      return {
        icon: <Volume2 className="size-6" />,
        title: "Getting ready…",
        hint: "The interviewer is about to ask the question.",
      };
  }
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

  // One tick per word the engine speaks. A few re-renders a second, which is
  // the cost of the avatar throbbing in time with the voice.
  const [wordPulse, setWordPulse] = useState(0);
  const onWord = useCallback(() => setWordPulse((count) => count + 1), []);

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
    speak(question, () => send({ type: "SPOKEN" }), onWord);
  }, [position, question, speak, send, onWord, recognition.reset]);

  // The microphone is open in exactly one state, so mirror that here.
  const listening = shouldListen(voice);
  const orbRef = useMicLevel(listening);
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
    speak(question, () => send({ type: "SPOKEN" }), onWord);
  };

  // `no-speech` is retried silently by the hook, so it is not shown as a fault.
  const fault =
    recognition.error && recognition.error !== "no-speech"
      ? recognition.error
      : null;

  const typeAction = (
    <Button
      variant="ghost"
      size="sm"
      onClick={onUseTyping}
      className="text-muted-foreground"
    >
      <Keyboard className="size-4" />
      Type
    </Button>
  );

  // A blocked microphone ends the spoken loop for this turn: the stage keeps
  // the question on screen and the only way forward is typing.
  if (voice.status === "blocked") {
    return (
      <Room
        session={session}
        turn={voiceTurnBar(session, voice, false, handleSubmit)}
        secondaries={typeAction}
      >
        <Stage session={session} orbState="error">
          <ErrorOverlay message={describeSpeechError(voice.reason)}>
            <Button onClick={onUseTyping}>Type my answer instead</Button>
          </ErrorOverlay>
        </Stage>
      </Room>
    );
  }

  const heard = recognition.finalTranscript || recognition.interimTranscript;
  const hasWords = heard.trim() !== "";

  return (
    <Room
      session={session}
      turn={voiceTurnBar(session, voice, hasWords, handleSubmit)}
      secondaries={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={readAgain}
            disabled={voice.status === "speaking" || submit.isPending}
            className="text-muted-foreground"
          >
            <Volume2 className="size-4" />
            Read again
          </Button>
          {typeAction}
        </>
      }
    >
      <Stage
        session={session}
        orbState={orbStateFor(voice, fault !== null)}
        orbPulse={wordPulse}
        orbRef={orbRef}
      >
        {/* Live captions: committed words plain, words still in flight italic. */}
        {canSubmit(voice) && (
          <p className="max-w-lg text-center text-sm">
            {hasWords ? (
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

  // Same rule as the spoken loop: the bar is only a button once there is an
  // answer to hand over.
  const last = isLastQuestion(session);
  const turn: TurnBarProps = submit.isPending
    ? {
        icon: <Send className="size-6" />,
        title: "Saving your answer…",
        hint: "Handing back to the interviewer.",
      }
    : answer.trim() === ""
      ? {
          icon: <Keyboard className="size-6" />,
          title: "Your turn",
          hint: "Type your answer above.",
        }
      : {
          icon: <Send className="size-6" />,
          title: last ? "Submit final answer" : "Submit answer",
          hint: last
            ? "This ends the session and writes your feedback report."
            : "Hands the turn back to the interviewer.",
          tone: last ? "warning" : "default",
          onClick: handleSubmit,
        };

  return (
    <Room
      session={session}
      turn={turn}
      secondaries={
        onUseVoice && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onUseVoice}
            className="text-muted-foreground"
          >
            <Mic className="size-4" />
            Voice
          </Button>
        )
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
