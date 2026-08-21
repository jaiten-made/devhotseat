/**
 * The client-side voice loop for one turn: the question is spoken, then the
 * user presses to talk, then the answer is submitted.
 *
 * The press is load-bearing. `speechSynthesis` renders straight to the output
 * device and hands out no audio object, so there is no way to observe when the
 * voice has actually stopped — `end` is the engine's claim, and it can be
 * early. Anything that opened the microphone off that signal would sooner or
 * later be recording while the app was still talking, and transcribing the
 * question into the answer. So the app stops guessing: the user says when they
 * are talking, which is a fact rather than an inference, and pressing while
 * the question is still being read cancels it the way interrupting a person
 * would. See [22](../../../docs/adr/0022-the-user-declares-their-turn.md).
 *
 * The same press starts the call. Arriving in the room reads nothing out: the
 * first question waits on `START`, so the interview begins when the user is
 * ready for it rather than the moment the page finishes loading.
 *
 * Deliberately separate from the session machine in src/server/session. That
 * one owns what is persisted — which turn is current and when the session ends
 * — and is rebuilt from the database. This one owns what is happening in the
 * browser right now, which is never stored.
 *
 * Pure, for the same reason as the other machine: a voice UI cannot be driven
 * from a headless browser, so the sequencing has to be testable without one.
 */

export type VoiceState =
  /**
   * In the room, nothing read out yet. The state a session is entered in: the
   * first question waits here until the user says to begin.
   */
  | { readonly status: "waiting" }
  /** Waiting on the turn, or on the server. */
  | { readonly status: "idle" }
  /** The question is being read. The microphone is shut. */
  | { readonly status: "speaking" }
  /**
   * The question has been read, or the engine says it has. The microphone is
   * still shut: it opens when the user presses, not when the voice claims to
   * be finished.
   */
  | { readonly status: "ready" }
  /** The microphone is open. */
  | { readonly status: "listening" }
  | { readonly status: "submitting" }
  /** Microphone unavailable or refused; the UI falls back to typing. */
  | { readonly status: "blocked"; readonly reason: string };

export type VoiceEvent =
  /** The user pressed to begin the interview. Only the first press does this. */
  | { readonly type: "START" }
  /** A new turn is ready to be read out. */
  | { readonly type: "ASK" }
  /** Speech synthesis finished, or could not start. */
  | { readonly type: "SPOKEN" }
  /**
   * The user pressed to talk. Valid while the question is still being read:
   * that is an interruption, and the caller silences the voice.
   */
  | { readonly type: "LISTEN" }
  | { readonly type: "SUBMIT" }
  | { readonly type: "SUBMITTED" }
  | { readonly type: "SUBMIT_FAILED" }
  | { readonly type: "MIC_BLOCKED"; readonly reason: string }
  /** Leave the blocked state, e.g. the user granted permission and retried. */
  | { readonly type: "RESET" };

const IDLE: VoiceState = { status: "idle" };

/**
 * Applies `event` to `state`. Unlike the session machine this never rejects:
 * a voice UI that refuses an event has no way to tell the user why, so an
 * event that does not apply simply leaves the state alone.
 */
export function voiceTransition(
  state: VoiceState,
  event: VoiceEvent,
): VoiceState {
  if (event.type === "MIC_BLOCKED") {
    return { status: "blocked", reason: event.reason };
  }
  if (event.type === "RESET") return IDLE;

  switch (state.status) {
    // Nothing is read until asked for. `ASK` is refused rather than obeyed,
    // so an effect that fires on arrival cannot start the interview by itself.
    case "waiting":
      return event.type === "START" ? IDLE : state;

    case "idle":
      return event.type === "ASK" ? { status: "speaking" } : state;

    case "speaking":
      // Interrupting is allowed, and is the only way the microphone opens
      // while the voice might still be going.
      if (event.type === "LISTEN") return { status: "listening" };
      // Whether the voice finished or never started, the turn is now the
      // user's to take: a failed read-out must not strand the session.
      return event.type === "SPOKEN" ? { status: "ready" } : state;

    case "ready":
      if (event.type === "LISTEN") return { status: "listening" };
      // Re-reading the question.
      return event.type === "ASK" ? { status: "speaking" } : state;

    case "listening":
      if (event.type === "SUBMIT") return { status: "submitting" };
      // A new turn can arrive while listening if the answer was submitted by
      // another route; re-reading is correct.
      return event.type === "ASK" ? { status: "speaking" } : state;

    case "submitting":
      if (event.type === "SUBMITTED") return IDLE;
      // Keep the microphone state so the transcript is not lost on a failure.
      return event.type === "SUBMIT_FAILED" ? { status: "listening" } : state;

    case "blocked":
      return state;
  }
}

/** The microphone should be open in exactly one state. */
export function shouldListen(state: VoiceState): boolean {
  return state.status === "listening";
}

/** Answers can only be sent while listening, and only once. */
export function canSubmit(state: VoiceState): boolean {
  return state.status === "listening";
}

/**
 * Turns a Web Speech error code into something that says what to do about it.
 *
 * `network` is the one worth naming explicitly: recognition is a hosted
 * service, and privacy-focused Chromium forks ship without the key for it, so
 * the code appears even when the machine is plainly online.
 */
export function describeSpeechError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was refused. Allow it for this site and reload.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return "Speech recognition could not reach its service. It is hosted by the browser vendor, and Brave and some other Chromium builds disable it — Google Chrome is the reliable option.";
    case "aborted":
      return "Listening stopped before anything was captured.";
    default:
      return `Speech recognition failed (${code}).`;
  }
}
