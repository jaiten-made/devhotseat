import { describe, expect, it } from "vitest";
import {
  canSubmit,
  shouldListen,
  type VoiceEvent,
  type VoiceState,
  voiceTransition,
} from "./machine";

const idle: VoiceState = { status: "idle" };
const speaking: VoiceState = { status: "speaking" };
const listening: VoiceState = { status: "listening" };
const submitting: VoiceState = { status: "submitting" };
const blocked: VoiceState = { status: "blocked", reason: "not-allowed" };

const ASK: VoiceEvent = { type: "ASK" };
const SPOKEN: VoiceEvent = { type: "SPOKEN" };
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
    ["idle + SUBMIT", idle, SUBMIT, idle],
    ["idle + SUBMITTED", idle, SUBMITTED, idle],
    ["idle + SUBMIT_FAILED", idle, SUBMIT_FAILED, idle],

    ["speaking + ASK", speaking, ASK, speaking],
    ["speaking + SPOKEN", speaking, SPOKEN, listening],
    ["speaking + SUBMIT", speaking, SUBMIT, speaking],
    ["speaking + SUBMITTED", speaking, SUBMITTED, speaking],
    ["speaking + SUBMIT_FAILED", speaking, SUBMIT_FAILED, speaking],

    ["listening + ASK", listening, ASK, speaking],
    ["listening + SPOKEN", listening, SPOKEN, listening],
    ["listening + SUBMIT", listening, SUBMIT, submitting],
    ["listening + SUBMITTED", listening, SUBMITTED, listening],
    ["listening + SUBMIT_FAILED", listening, SUBMIT_FAILED, listening],

    ["submitting + ASK", submitting, ASK, submitting],
    ["submitting + SPOKEN", submitting, SPOKEN, submitting],
    ["submitting + SUBMIT", submitting, SUBMIT, submitting],
    ["submitting + SUBMITTED", submitting, SUBMITTED, idle],
    ["submitting + SUBMIT_FAILED", submitting, SUBMIT_FAILED, listening],

    ["blocked + ASK", blocked, ASK, blocked],
    ["blocked + SPOKEN", blocked, SPOKEN, blocked],
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
    expect(step(SPOKEN)).toEqual(listening);
    expect(step(SUBMIT)).toEqual(submitting);
    expect(step(SUBMITTED)).toEqual(idle);
    // The next turn starts the same way.
    expect(step(ASK)).toEqual(speaking);
  });

  it("keeps listening when a submission fails, so the answer is not lost", () => {
    const state = voiceTransition(submitting, SUBMIT_FAILED);
    expect(state).toEqual(listening);
    expect(canSubmit(state)).toBe(true);
  });

  it("moves on to listening even when the question could not be spoken", () => {
    // SPOKEN is sent whether synthesis finished or never started.
    expect(voiceTransition(speaking, SPOKEN)).toEqual(listening);
  });
});

describe("guards", () => {
  it("opens the microphone only while listening", () => {
    expect([idle, speaking, submitting, blocked].map(shouldListen)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(shouldListen(listening)).toBe(true);
  });

  it("allows submitting only while listening", () => {
    expect([idle, speaking, submitting, blocked].map(canSubmit)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(canSubmit(listening)).toBe(true);
  });
});
