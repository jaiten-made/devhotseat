import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileText,
  Keyboard,
  Mic,
  MicOff,
  PhoneOff,
  Play,
  Send,
  Volume2,
} from "lucide-react";
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ErrorOverlay,
  Lobby,
  Orb,
  TranscriptPanel,
  TurnBar,
} from "@/components/interview";
import { ReportView } from "@/components/report";
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
import {
  Marker,
  Notice,
  Page,
  PageHeader,
  Panel,
  Section,
} from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";
import { answerTurn, leaveSession } from "@/fn/sessions";
import { sessionQuery } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  canSubmit,
  describeSpeechError,
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

type TurnBarProps = ComponentProps<typeof TurnBar>;

function SessionView() {
  const { sessionId } = Route.useParams();
  const session = useQuery(sessionQuery(sessionId));

  // Every branch keeps the same header, so the screen does not rebuild itself
  // around the content once the query lands.
  if (session.isPending) {
    return (
      <Page>
        <PageHeader eyebrow="Loading" title="Session" />
        <Notice>Loading session…</Notice>
      </Page>
    );
  }
  if (session.isError) {
    return (
      <Page>
        <PageHeader eyebrow="Unavailable" title="Session" />
        <Notice tone="destructive" role="alert">
          Could not load this session: {session.error.message}
        </Notice>
      </Page>
    );
  }
  if (session.data === null) {
    return (
      <Page>
        <PageHeader eyebrow="Not found" title="Session" />
        <Notice>
          That session does not exist.{" "}
          <Link
            to="/sessions"
            className="font-medium text-ink underline underline-offset-4"
          >
            Back to sessions
          </Link>
          .
        </Notice>
      </Page>
    );
  }

  // `ended_at` is the whole status: null means the room is still open.
  return session.data.endedAt === null ? (
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
 * full-viewport column of header, stage and turn control, with the transcript
 * as a panel down its right side.
 *
 * It covers the app chrome for the duration of the call, the way devprep's
 * meeting room sits outside the sidebar layout. Fixed positioning rather than
 * a layout route keeps the change to this one screen.
 *
 * The bottom of the room is one wide `TurnBar` naming whose move it is, and
 * under it the incidentals as plain ghost buttons. Only the bar is ever filled,
 * so the thing that moves the conversation on cannot be mistaken for the thing
 * that opens a panel. Hanging up lives in the header for the same reason.
 *
 * There is one way out and it ends the interview, so the header holds one exit
 * rather than a back arrow beside it: two controls where only one thing can
 * happen would have to be lying about something. See
 * [24](../../docs/adr/0024-leaving-the-room-ends-the-interview.md).
 */
function Room({
  session,
  turn,
  subtitle,
  secondaries,
  children,
}: {
  session: SessionDetail;
  /** Whose turn it is, and the move if it is yours. */
  turn: TurnBarProps;
  /**
   * Replaces the progress line. The lobby uses it: counting the question you
   * are on reads as a claim that the interview is under way.
   */
  subtitle?: string;
  /** The incidentals this input mode adds beside the transcript toggle. */
  secondaries: ReactNode;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [showTranscript, setShowTranscript] = useState(false);

  // Leaving is an ending, so it goes through the server. Nothing navigates
  // afterwards: the session comes back ended, and this page is already the
  // transcript of an ended session, report and all.
  const end = useMutation({
    mutationFn: async () => {
      const result = await leaveSession({ data: { id: session.id } });
      if (!result.ok) throw new Error(describeEndFailure(result.reason));
      return result;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });

  return (
    // A row, so the transcript stands beside the room rather than under it.
    <div className="fixed inset-0 z-50 flex bg-paper">
      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          The same eyebrow-over-title the app's other screens lead with. The
          room covers the nav, so this header is the only thing left saying
          where you are — which is exactly the job the eyebrow does elsewhere.
        */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-rule px-4">
          <div className="min-w-0 flex-1">
            <p className="field-label truncate">
              {subtitle ??
                `Question ${session.currentPosition} of ${session.questionCount}`}
            </p>
            <p className="mt-1 truncate text-sm font-semibold leading-none">
              Interview session
            </p>
          </div>
          <EndInterview
            session={session}
            onConfirm={() => end.mutate()}
            pending={end.isPending}
          />
        </header>

        {end.isError && (
          <p
            role="alert"
            className="shrink-0 border-b border-destructive/25 bg-destructive/5 px-4 py-2 text-center text-sm text-destructive"
          >
            {end.error.message} The interview is still running.
          </p>
        )}

        <main className="flex flex-1 flex-col items-center justify-center gap-7 overflow-y-auto px-6 py-8">
          {children}
        </main>

        {/* The control deck, set as a white sheet under the room's off-white
            so the one thing you can press has a surface of its own. */}
        <div className="flex shrink-0 flex-col items-center gap-3 border-t border-rule bg-sheet px-4 py-5">
          <TurnBar {...turn} />
          <div className="flex flex-wrap items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTranscript((open) => !open)}
              className={cn(
                "text-ink-muted hover:text-ink",
                showTranscript && "bg-wash text-ink",
              )}
            >
              <FileText className="size-4" />
              Transcript
            </Button>
            {secondaries}
          </div>
        </div>
      </div>

      <TranscriptPanel
        isOpen={showTranscript}
        onToggle={() => setShowTranscript((open) => !open)}
        turns={session.turns}
      />
    </div>
  );
}

function describeEndFailure(reason: string): string {
  switch (reason) {
    case "not_found":
      return "That session no longer exists.";
    case "session_already_ended":
      return "This interview has already ended somewhere else.";
    default:
      return "Could not end the interview.";
  }
}

/**
 * The one way out of the room, and it ends the interview — so it says what that
 * costs before doing it, the way deleting a session does.
 *
 * What it names is what the report will be written from, because that is the
 * part that cannot be got back: the remaining questions are still in the bank
 * and come round again in the next session.
 */
function EndInterview({
  session,
  onConfirm,
  pending,
}: {
  session: SessionDetail;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          tone="destructive"
          disabled={pending}
          className="shrink-0 text-ink-muted"
        >
          <PhoneOff className="size-4" />
          {pending ? "Ending…" : "End interview"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End this interview?</AlertDialogTitle>
          <AlertDialogDescription>
            {describeEnding(session)} You cannot come back to it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep going</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            End interview
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function describeEnding(session: SessionDetail): string {
  const left = session.questionCount - session.answeredCount;
  if (session.answeredCount === 0) {
    return "You have not answered anything yet, so there is nothing to write a report from.";
  }
  const answers =
    session.answeredCount === 1
      ? "1 answer"
      : `${session.answeredCount} answers`;
  const unasked = left === 1 ? "1 question" : `${left} questions`;
  return `Your report will be written from the ${answers} you have given, and the remaining ${unasked} will go unanswered.`;
}

/**
 * The question, and the last thing on the stage that is fixed for every mode.
 * Sized to be readable from a lean-back distance, since the point of the room
 * is that you are talking rather than reading.
 */
function Stage({
  session,
  listening = false,
  children,
}: {
  session: SessionDetail;
  /** Whether the microphone is open; see `Orb`. */
  listening?: boolean;
  children?: ReactNode;
}) {
  return (
    <>
      <Orb listening={listening} />
      {/* The loudest thing on any screen in this app, by design: it is the
          only sentence you are meant to be answering from memory. */}
      <h1 className="max-w-2xl text-balance text-center text-2xl font-semibold leading-snug tracking-tight md:text-[1.75rem]">
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
  onStart: () => void,
  onStartTalking: () => void,
  onSubmit: () => void,
): TurnBarProps {
  switch (voice.status) {
    // Nothing has been read yet, and nothing will be until this is pressed.
    // Entering the room is not consent to be talked at: the tab may have been
    // opened minutes ago, or in the background.
    case "waiting":
      return {
        icon: <Play className="size-6" />,
        title: "Start the interview",
        hint: "Press when you are ready. The first question will be read aloud.",
        onClick: onStart,
      };
    // Pressable while the question is still being read: interrupting is
    // allowed, and the hint says so rather than telling you to wait.
    case "speaking":
    case "ready":
      return {
        icon: <Mic className="size-6" />,
        title: "Start answering",
        hint:
          voice.status === "speaking"
            ? "Press when you want to talk. You can cut in while the question is still being read."
            : "Press to open the microphone.",
        onClick: onStartTalking,
      };
    case "listening":
      if (!hasWords) {
        return {
          icon: <Mic className="size-6" />,
          title: "Listening",
          hint: "Your words appear above as you speak.",
        };
      }
      return isLastQuestion(session)
        ? {
            icon: <Send className="size-6" />,
            title: "Send final answer",
            hint: "This ends the session and writes your feedback report.",
            tone: "warning",
            onClick: onSubmit,
          }
        : {
            icon: <Send className="size-6" />,
            title: "Send answer",
            hint: "Hands the turn back to the interviewer.",
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
  // Entered waiting, not idle: see `voiceTurnBar`'s first case.
  const [voice, setVoice] = useState<VoiceState>({ status: "waiting" });
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
  const waiting = voice.status === "waiting";
  useEffect(() => {
    // The first question is not read until the user starts the interview.
    // Only the first: `waiting` is the state the room is entered in and
    // nothing returns to it, so later turns still follow on by themselves.
    if (waiting) return;
    if (position === null || spokenForRef.current === position) return;
    spokenForRef.current = position;
    // Shut the microphone here rather than leaving it to the effect below.
    // `send` only queues the state change, so `listening` does not go false
    // until the next render — but `speak` starts talking on this line. The
    // effect would close the mic a render too late, with the voice already
    // going into it.
    recognition.stop();
    recognition.reset();
    send({ type: "ASK" });
    speak(question, () => send({ type: "SPOKEN" }));
  }, [
    waiting,
    position,
    question,
    speak,
    send,
    recognition.reset,
    recognition.stop,
  ]);

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

  // Interrupting is what makes the missing completion signal harmless: the
  // voice is silenced here, so the microphone is never open while the app is
  // talking, whatever `speechSynthesis` believes about being finished.
  const start = () => send({ type: "START" });

  const startTalking = () => {
    cancel();
    send({ type: "LISTEN" });
  };

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
    // Closed before speaking, not by the machine afterwards: this is pressed
    // while listening, so the mic is live and `speak` starts on the line below,
    // a render before the state change would have shut it. What has been
    // heard so far is kept — re-reading the question is not giving up on the
    // answer already given.
    recognition.stop();
    send({ type: "ASK" });
    speak(question, () => send({ type: "SPOKEN" }));
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
      className="text-ink-muted hover:text-ink"
    >
      <Keyboard className="size-4" />
      Type
    </Button>
  );

  // Before the first press there is no question on the stage to read off, so
  // the room shows the briefing instead. See `Lobby`.
  if (waiting) {
    return (
      <Room
        session={session}
        turn={voiceTurnBar(
          session,
          voice,
          false,
          start,
          startTalking,
          handleSubmit,
        )}
        subtitle="Not started"
        secondaries={typeAction}
      >
        <Lobby questionCount={session.questionCount} />
      </Room>
    );
  }

  // A blocked microphone ends the spoken loop for this turn: the stage keeps
  // the question on screen and the only way forward is typing.
  if (voice.status === "blocked") {
    return (
      <Room
        session={session}
        turn={voiceTurnBar(
          session,
          voice,
          false,
          start,
          startTalking,
          handleSubmit,
        )}
        secondaries={typeAction}
      >
        <Stage session={session}>
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
      turn={voiceTurnBar(
        session,
        voice,
        hasWords,
        start,
        startTalking,
        handleSubmit,
      )}
      secondaries={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={readAgain}
            disabled={submit.isPending}
            className="text-ink-muted hover:text-ink"
          >
            <Volume2 className="size-4" />
            Read again
          </Button>
          {typeAction}
        </>
      }
    >
      <Stage session={session} listening={listening}>
        {/* Live captions: committed words plain, words still in flight italic.
            Set on a sheet, because this is your answer being written down —
            and a fixed surface keeps the stage from jumping as words land. */}
        {canSubmit(voice) && (
          <p className="w-full max-w-lg rounded-lg border border-rule bg-sheet px-4 py-3.5 text-center text-sm leading-relaxed">
            {hasWords ? (
              <>
                <span className="text-ink">{recognition.finalTranscript}</span>
                {recognition.interimTranscript && (
                  <span className="italic text-ink-faint">
                    {" "}
                    {recognition.interimTranscript}
                  </span>
                )}
              </>
            ) : (
              <span className="italic text-ink-faint">
                Your answer appears here as you speak.
              </span>
            )}
          </p>
        )}

        {fault && (
          <p className="max-w-sm text-center text-sm leading-relaxed text-destructive">
            {describeSpeechError(fault)}
          </p>
        )}
        {submit.isError && (
          <p className="max-w-sm text-center text-sm leading-relaxed text-destructive">
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
            className="text-ink-muted hover:text-ink"
          >
            <Mic className="size-4" />
            Voice
          </Button>
        )
      }
    >
      {/* The avatar stays put so switching input modes does not change rooms.
          Typing never opens the microphone, so it is always inert; the turn
          bar reports saving. */}
      <Stage session={session}>
        <Textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Type your answer…"
          aria-label="Your answer"
          rows={6}
          className="w-full max-w-lg"
        />
        {submit.isError && (
          <p className="max-w-sm text-center text-sm leading-relaxed text-destructive">
            Could not save that answer: {submit.error.message}
          </p>
        )}
      </Stage>
    </Room>
  );
}

/** Milestone 8: the report if one was written, and the full Q&A exchange. */
function Transcript({ session }: { session: SessionDetail }) {
  return (
    <Page>
      <PageHeader
        eyebrow={new Date(session.startedAt).toLocaleString()}
        title="Session review"
        description="Everything you were asked, everything you said, and the feedback written from it."
      />

      {/*
        The feedback leads. The answers are already known to whoever gave them,
        so scrolling past all of them to reach the verdict buries the one thing
        they came back for.
      */}
      <Section title="Feedback">
        {session.report ? (
          <ReportView report={session.report} turns={session.turns} />
        ) : (
          // A missing report is a degraded state, not an error: the amber tint
          // says something is absent without claiming anything went wrong.
          <Notice tone="warning">
            No report was written for this session. The transcript below is
            still complete.
          </Notice>
        )}
      </Section>

      <Section title="Transcript">
        {/* Numbered, because the turns are a sequence and the report above
            refers back to them by position. */}
        <ol className="space-y-3">
          {session.turns.map((turn) => (
            <li key={turn.position}>
              <Panel className="p-5">
                <div className="flex items-baseline gap-2.5">
                  <Marker index={turn.position} total={session.questionCount} />
                  <p className="min-w-0 flex-1 font-medium leading-snug">
                    {turn.questionText}
                  </p>
                </div>
                <p className="mt-3 border-l-2 border-rule pl-3.5 whitespace-pre-wrap leading-relaxed text-ink-muted">
                  {turn.answerText ?? "(not answered)"}
                </p>
              </Panel>
            </li>
          ))}
        </ol>
      </Section>
    </Page>
  );
}
