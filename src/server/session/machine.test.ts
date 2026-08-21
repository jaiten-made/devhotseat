import { describe, expect, it } from "vitest";
import {
  type MachineEvent,
  type MachineState,
  stateFromSession,
  transition,
} from "./machine";

const START: MachineEvent = { type: "START", availableQuestions: 3 };
const SUBMIT: MachineEvent = { type: "SUBMIT_ANSWER" };
const END: MachineEvent = { type: "END" };
const READY: MachineEvent = { type: "REPORT_READY" };
const FAILED: MachineEvent = { type: "REPORT_FAILED" };

const awaiting = (position: number): MachineState => ({
  status: "awaiting_answer",
  position,
  questionCount: 3,
});
const generating: MachineState = {
  status: "generating_report",
  questionCount: 3,
};
const completed: MachineState = {
  status: "completed",
  questionCount: 3,
  hasReport: true,
};

describe("transition — the full state x event matrix", () => {
  // Every combination of state and event is listed here, so a new state or
  // event cannot be added without a deliberate decision about each pairing.
  const cases: ReadonlyArray<
    [
      label: string,
      state: MachineState | null,
      event: MachineEvent,
      expected: unknown,
    ]
  > = [
    ["no session + START", null, START, { ok: true, state: awaiting(1) }],
    [
      "no session + SUBMIT",
      null,
      SUBMIT,
      { ok: false, reason: "session_not_started" },
    ],
    [
      "no session + END",
      null,
      END,
      { ok: false, reason: "session_not_started" },
    ],
    [
      "no session + READY",
      null,
      READY,
      { ok: false, reason: "session_not_started" },
    ],
    [
      "no session + FAILED",
      null,
      FAILED,
      { ok: false, reason: "session_not_started" },
    ],

    [
      "mid session + START",
      awaiting(1),
      START,
      { ok: false, reason: "session_already_started" },
    ],
    [
      "mid session + SUBMIT",
      awaiting(1),
      SUBMIT,
      { ok: true, state: awaiting(2) },
    ],
    ["mid session + END", awaiting(1), END, { ok: true, state: generating }],
    [
      "mid session + READY",
      awaiting(1),
      READY,
      { ok: false, reason: "report_not_pending" },
    ],
    [
      "mid session + FAILED",
      awaiting(1),
      FAILED,
      { ok: false, reason: "report_not_pending" },
    ],

    [
      "final turn + START",
      awaiting(3),
      START,
      { ok: false, reason: "session_already_started" },
    ],
    [
      "final turn + SUBMIT",
      awaiting(3),
      SUBMIT,
      { ok: true, state: generating },
    ],
    ["final turn + END", awaiting(3), END, { ok: true, state: generating }],
    [
      "final turn + READY",
      awaiting(3),
      READY,
      { ok: false, reason: "report_not_pending" },
    ],
    [
      "final turn + FAILED",
      awaiting(3),
      FAILED,
      { ok: false, reason: "report_not_pending" },
    ],

    [
      "generating + START",
      generating,
      START,
      { ok: false, reason: "session_already_started" },
    ],
    [
      "generating + SUBMIT",
      generating,
      SUBMIT,
      { ok: false, reason: "not_awaiting_answer" },
    ],
    [
      "generating + END",
      generating,
      END,
      { ok: false, reason: "not_awaiting_answer" },
    ],
    ["generating + READY", generating, READY, { ok: true, state: completed }],
    [
      "generating + FAILED",
      generating,
      FAILED,
      {
        ok: true,
        state: { status: "completed", questionCount: 3, hasReport: false },
      },
    ],

    [
      "completed + START",
      completed,
      START,
      { ok: false, reason: "session_already_started" },
    ],
    [
      "completed + SUBMIT",
      completed,
      SUBMIT,
      { ok: false, reason: "session_already_ended" },
    ],
    [
      "completed + END",
      completed,
      END,
      { ok: false, reason: "session_already_ended" },
    ],
    [
      "completed + READY",
      completed,
      READY,
      { ok: false, reason: "session_already_ended" },
    ],
    [
      "completed + FAILED",
      completed,
      FAILED,
      { ok: false, reason: "session_already_ended" },
    ],
  ];

  it.each(cases)("%s", (_label, state, event, expected) => {
    expect(transition(state, event)).toEqual(expected);
  });
});

describe("starting a session", () => {
  it("rejects an empty bank", () => {
    expect(transition(null, { type: "START", availableQuestions: 0 })).toEqual({
      ok: false,
      reason: "empty_question_bank",
    });
  });

  it("starts on a single question", () => {
    expect(transition(null, { type: "START", availableQuestions: 1 })).toEqual({
      ok: true,
      state: { status: "awaiting_answer", position: 1, questionCount: 1 },
    });
  });

  // A session is the whole bank, so its length is just the bank size.
  it.each([1, 2, 5, 9, 40])(
    "a bank of %i questions gives a session of the same length",
    (available) => {
      expect(
        transition(null, { type: "START", availableQuestions: available }),
      ).toEqual({
        ok: true,
        state: {
          status: "awaiting_answer",
          position: 1,
          questionCount: available,
        },
      });
    },
  );

  it("ends a one-question session on its only answer", () => {
    const started = transition(null, { type: "START", availableQuestions: 1 });
    if (!started.ok) throw new Error("expected a session");
    expect(transition(started.state, SUBMIT)).toEqual({
      ok: true,
      state: { status: "generating_report", questionCount: 1 },
    });
  });

  // A count that is not a positive integer can only come from a bug upstream.
  it.each([-1, 2.5])("rejects a bank count of %s", (availableQuestions) => {
    expect(transition(null, { type: "START", availableQuestions })).toEqual({
      ok: false,
      reason: "empty_question_bank",
    });
  });
});

describe("auto-ending", () => {
  it("ends on the last answer and not before", () => {
    const questionCount = 5;
    let state = (
      transition(null, {
        type: "START",
        availableQuestions: questionCount,
      }) as { state: MachineState }
    ).state;

    // The first four answers must each leave the session waiting for another.
    for (let answer = 1; answer <= questionCount - 1; answer++) {
      const result = transition(state, SUBMIT);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state).toEqual({
        status: "awaiting_answer",
        position: answer + 1,
        questionCount,
      });
      state = result.state;
    }

    // The fifth ends it, with no explicit end event.
    const final = transition(state, SUBMIT);
    expect(final).toEqual({
      ok: true,
      state: { status: "generating_report", questionCount },
    });
  });

  it("walks start to completed report in one pass", () => {
    let state: MachineState | null = null;
    const step = (event: MachineEvent) => {
      const result = transition(state, event);
      if (!result.ok) throw new Error(`unexpected rejection: ${result.reason}`);
      state = result.state;
    };

    step({ type: "START", availableQuestions: 3 });
    step(SUBMIT);
    step(SUBMIT);
    step(SUBMIT);
    expect(state).toEqual({ status: "generating_report", questionCount: 3 });
    step(READY);
    expect(state).toEqual({
      status: "completed",
      questionCount: 3,
      hasReport: true,
    });
  });

  it("still completes the session when the report fails", () => {
    const result = transition(generating, FAILED);
    expect(result).toEqual({
      ok: true,
      state: { status: "completed", questionCount: 3, hasReport: false },
    });
  });
});

describe("ending early", () => {
  // Leaving the room. The session ends where it stands rather than staying
  // open, so there is no such thing as a session nothing can finish.
  it("ends from any turn, not just the last", () => {
    expect(transition(awaiting(1), END)).toEqual({
      ok: true,
      state: generating,
    });
    expect(transition(awaiting(2), END)).toEqual({
      ok: true,
      state: generating,
    });
  });

  it("takes the same terminal path as the last answer", () => {
    const left = transition(awaiting(1), END);
    const answered = transition(awaiting(3), SUBMIT);
    if (!left.ok || !answered.ok) throw new Error("expected both to be taken");
    expect(left.state).toEqual(answered.state);
  });

  it("refuses to end a session twice", () => {
    const left = transition(awaiting(1), END);
    if (!left.ok) throw new Error("expected a generating session");
    expect(transition(left.state, END)).toEqual({
      ok: false,
      reason: "not_awaiting_answer",
    });
    expect(transition(completed, END)).toEqual({
      ok: false,
      reason: "session_already_ended",
    });
  });
});

describe("stateFromSession", () => {
  it("puts a fresh session on the first turn", () => {
    expect(
      stateFromSession({ endedAt: null, questionCount: 5 }, 0, false),
    ).toEqual({
      status: "awaiting_answer",
      position: 1,
      questionCount: 5,
    });
  });

  it("puts a part-answered session on the next unanswered turn", () => {
    expect(
      stateFromSession({ endedAt: null, questionCount: 5 }, 2, false),
    ).toEqual({
      status: "awaiting_answer",
      position: 3,
      questionCount: 5,
    });
  });

  it("reads a completed session with a report", () => {
    expect(
      stateFromSession(
        { endedAt: new Date("2026-08-22T00:00:00Z"), questionCount: 5 },
        5,
        true,
      ),
    ).toEqual({
      status: "completed",
      questionCount: 5,
      hasReport: true,
    });
  });

  it("reads a completed session whose report is missing", () => {
    expect(
      stateFromSession(
        { endedAt: new Date("2026-08-22T00:00:00Z"), questionCount: 5 },
        5,
        false,
      ),
    ).toEqual({
      status: "completed",
      questionCount: 5,
      hasReport: false,
    });
  });

  it("can be ended once rebuilt from a running session", () => {
    const state = stateFromSession(
      { endedAt: null, questionCount: 5 },
      2,
      false,
    );
    expect(transition(state, END)).toEqual({
      ok: true,
      state: { status: "generating_report", questionCount: 5 },
    });
  });

  it("rejects a further answer once rebuilt from a completed session", () => {
    const state = stateFromSession(
      { endedAt: new Date("2026-08-22T00:00:00Z"), questionCount: 5 },
      5,
      true,
    );
    expect(transition(state, SUBMIT)).toEqual({
      ok: false,
      reason: "session_already_ended",
    });
  });
});
