/**
 * The client-side voice loop for one turn: the question is spoken, then the
 * microphone opens, then the answer is submitted.
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
  | { readonly status: "idle" }
  | { readonly status: "speaking" }
  | { readonly status: "listening" }
  | { readonly status: "submitting" }
  /** Microphone unavailable or refused; the UI falls back to typing. */
  | { readonly status: "blocked"; readonly reason: string };

export type VoiceEvent =
  /** A new turn is ready to be read out. */
  | { readonly type: "ASK" }
  /** Speech synthesis finished, or could not start. */
  | { readonly type: "SPOKEN" }
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
    case "idle":
      return event.type === "ASK" ? { status: "speaking" } : state;

    case "speaking":
      // Whether the voice finished or never started, the turn moves on to
      // listening: a failed read-out must not strand the session.
      return event.type === "SPOKEN" ? { status: "listening" } : state;

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
 * The look the interviewer's avatar takes. Named after the activity rather
 * than the state it came from, because the typed turn has no voice loop and
 * still needs an avatar.
 */
export type OrbState = "idle" | "thinking" | "speaking" | "listening" | "error";

/**
 * Which look goes with the current voice state. Kept here with the states it
 * is derived from, and pure, so the mapping is covered by unit tests rather
 * than by eye — a stuck or wrongly coloured avatar is the one bug in this UI
 * that a user would notice immediately and a test would otherwise miss.
 *
 * `hasFault` folds in the recognition errors that are worth showing while the
 * microphone is nominally open, which the state alone cannot express.
 */
export function orbStateFor(state: VoiceState, hasFault: boolean): OrbState {
  switch (state.status) {
    case "blocked":
      return "error";
    case "speaking":
      return "speaking";
    case "listening":
      return hasFault ? "error" : "listening";
    // Waiting on the turn or on the server: the same "something is coming"
    // look, so a submit does not flash the avatar back to inert.
    case "idle":
    case "submitting":
      return "thinking";
  }
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
