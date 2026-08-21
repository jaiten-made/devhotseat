import { describe, expect, it } from "vitest";
import {
  canSubmit,
  describeSpeechError,
  shouldListen,
  type VoiceEvent,
  type VoiceState,
  voiceTransition,
} from "./machine";

const idle: VoiceState = { status: "idle" };
const speaking: VoiceState = { status: "speaking" };
const ready: VoiceState = { status: "ready" };
const listening: VoiceState = { status: "listening" };
const submitting: VoiceState = { status: "submitting" };
const blocked: VoiceState = { status: "blocked", reason: "not-allowed" };

const ASK: VoiceEvent = { type: "ASK" };
const SPOKEN: VoiceEvent = { type: "SPOKEN" };
const LISTEN: VoiceEvent = { type: "LISTEN" };
const SUBMIT: VoiceEvent = { type: "SUBMIT" };
const SUBMITTED: VoiceEvent = { type: "SUBMITTED" };
const SUBMIT_FAILED: VoiceEvent = { type: "SUBMIT_FAILED" };
const BLOCK: VoiceEvent = { type: "MIC_BLOCKED", reason: "not-allowed" };
const RESET: VoiceEvent = { type: "RESET" };

describe("voiceTransition — the full state x event matrix", () => {
  // Every pairing is listed, so a new state or event forces a decision here.
  const cases: ReadonlyArray<
    [label: string, from: VoiceState, event: VoiceEvent, to: VoiceState]
  > = [
    ["idle + ASK", idle, ASK, speaking],
    ["idle + SPOKEN", idle, SPOKEN, idle],
    ["idle + LISTEN", idle, LISTEN, idle],
    ["idle + SUBMIT", idle, SUBMIT, idle],
    ["idle + SUBMITTED", idle, SUBMITTED, idle],
    ["idle + SUBMIT_FAILED", idle, SUBMIT_FAILED, idle],

    ["speaking + ASK", speaking, ASK, speaking],
    ["speaking + SPOKEN", speaking, SPOKEN, ready],
    // Cutting in over the question is allowed, and is the only route to an
    // open microphone that does not wait on the voice claiming to be done.
    ["speaking + LISTEN", speaking, LISTEN, listening],
    ["speaking + SUBMIT", speaking, SUBMIT, speaking],
    ["speaking + SUBMITTED", speaking, SUBMITTED, speaking],
    ["speaking + SUBMIT_FAILED", speaking, SUBMIT_FAILED, speaking],

    ["ready + ASK", ready, ASK, speaking],
    ["ready + SPOKEN", ready, SPOKEN, ready],
    ["ready + LISTEN", ready, LISTEN, listening],
    ["ready + SUBMIT", ready, SUBMIT, ready],
    ["ready + SUBMITTED", ready, SUBMITTED, ready],
    ["ready + SUBMIT_FAILED", ready, SUBMIT_FAILED, ready],

    ["listening + ASK", listening, ASK, speaking],
    ["listening + SPOKEN", listening, SPOKEN, listening],
    ["listening + LISTEN", listening, LISTEN, listening],
    ["listening + SUBMIT", listening, SUBMIT, submitting],
    ["listening + SUBMITTED", listening, SUBMITTED, listening],
    ["listening + SUBMIT_FAILED", listening, SUBMIT_FAILED, listening],

    ["submitting + ASK", submitting, ASK, submitting],
    ["submitting + SPOKEN", submitting, SPOKEN, submitting],
    ["submitting + LISTEN", submitting, LISTEN, submitting],
    ["submitting + SUBMIT", submitting, SUBMIT, submitting],
    ["submitting + SUBMITTED", submitting, SUBMITTED, idle],
    ["submitting + SUBMIT_FAILED", submitting, SUBMIT_FAILED, listening],

    ["blocked + ASK", blocked, ASK, blocked],
    ["blocked + SPOKEN", blocked, SPOKEN, blocked],
    ["blocked + LISTEN", blocked, LISTEN, blocked],
    ["blocked + SUBMIT", blocked, SUBMIT, blocked],
    ["blocked + SUBMITTED", blocked, SUBMITTED, blocked],
    ["blocked + SUBMIT_FAILED", blocked, SUBMIT_FAILED, blocked],
  ];

  it.each(cases)("%s", (_label, from, event, to) => {
    expect(voiceTransition(from, event)).toEqual(to);
  });

  it.each([
    ["idle", idle],
    ["speaking", speaking],
    ["ready", ready],
    ["listening", listening],
    ["submitting", submitting],
    ["blocked", blocked],
  ])("MIC_BLOCKED interrupts %s from anywhere", (_label, from) => {
    expect(voiceTransition(from, BLOCK)).toEqual(blocked);
  });

  it("RESET leaves the blocked state", () => {
    expect(voiceTransition(blocked, RESET)).toEqual(idle);
  });
});

describe("one turn, start to finish", () => {
  it("speaks, listens, submits, then returns to idle for the next turn", () => {
    let state: VoiceState = idle;
    const step = (event: VoiceEvent) => {
      state = voiceTransition(state, event);
      return state;
    };

    expect(step(ASK)).toEqual(speaking);
    // The voice finishing does not open the microphone. Nothing does but a
    // press, which is the whole point.
    expect(step(SPOKEN)).toEqual(ready);
    expect(shouldListen(state)).toBe(false);
    expect(step(LISTEN)).toEqual(listening);
    expect(step(SUBMIT)).toEqual(submitting);
    expect(step(SUBMITTED)).toEqual(idle);
    // The next turn starts the same way.
    expect(step(ASK)).toEqual(speaking);
  });

  it("lets the user cut in without waiting for the question to finish", () => {
    let state: VoiceState = idle;
    state = voiceTransition(state, ASK);
    expect(state).toEqual(speaking);
    // No SPOKEN in between: the question is still being read.
    state = voiceTransition(state, LISTEN);
    expect(state).toEqual(listening);
    expect(shouldListen(state)).toBe(true);
    expect(canSubmit(state)).toBe(true);
  });

  it("keeps listening when a submission fails, so the answer is not lost", () => {
    const state = voiceTransition(submitting, SUBMIT_FAILED);
    expect(state).toEqual(listening);
    expect(canSubmit(state)).toBe(true);
  });

  it("still offers the turn when the question could not be spoken", () => {
    // SPOKEN is sent whether synthesis finished or never started, and either
    // way it lands in `ready` with the microphone shut, waiting on a press.
    const state = voiceTransition(speaking, SPOKEN);
    expect(state).toEqual(ready);
    expect(shouldListen(state)).toBe(false);
    expect(voiceTransition(state, LISTEN)).toEqual(listening);
  });
});

describe("guards", () => {
  it("opens the microphone only while listening", () => {
    expect(
      [idle, speaking, ready, submitting, blocked].map(shouldListen),
    ).toEqual([false, false, false, false, false]);
    expect(shouldListen(listening)).toBe(true);
  });

  it("allows submitting only while listening", () => {
    expect([idle, speaking, ready, submitting, blocked].map(canSubmit)).toEqual(
      [false, false, false, false, false],
    );
    expect(canSubmit(listening)).toBe(true);
  });

  it("takes a press to open the microphone from either speaking state", () => {
    // Both, because interrupting is allowed. Accepting LISTEN only after
    // SPOKEN would put the microphone behind a signal that cannot be trusted.
    expect(voiceTransition(speaking, LISTEN)).toEqual(listening);
    expect(voiceTransition(ready, LISTEN)).toEqual(listening);
  });

  it("ignores a press where there is nothing to answer", () => {
    for (const state of [idle, submitting, blocked]) {
      expect(voiceTransition(state, LISTEN)).toEqual(state);
    }
  });
});

describe("describeSpeechError", () => {
  it("names the browser as the cause for a network failure", () => {
    const message = describeSpeechError("network");
    expect(message).toMatch(/recognition/i);
    // The code alone reads as a connectivity problem, which it usually is not.
    expect(message).toMatch(/Chrome/);
  });

  it("tells the user what to do about a refused microphone", () => {
    for (const code of ["not-allowed", "service-not-allowed"]) {
      expect(describeSpeechError(code)).toMatch(/allow it for this site/i);
    }
  });

  it("reports a missing microphone plainly", () => {
    expect(describeSpeechError("audio-capture")).toMatch(/no microphone/i);
  });

  it("falls back to quoting an unknown code rather than swallowing it", () => {
    expect(describeSpeechError("something-new")).toContain("something-new");
  });
});
