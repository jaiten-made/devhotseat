/**
 * The interview session state machine.
 *
 * A pure transition function, deliberately not a state-machine library. The
 * HTTP layer needs a *reason* when it rejects an event so it can pick a status
 * code, and "unhandled events are ignored" is the wrong default for that.
 *
 * The machine is the only thing that decides when a session ends. It is
 * parameterised by `questionCount` rather than importing SESSION_LENGTH, so
 * the constant keeps its single home in config.ts while the rules live here.
 *
 * `generating_report` is never persisted. Report generation happens in-process
 * during the request that submits the final answer, so the database only ever
 * sees a session as in_progress or completed.
 */

export type MachineState =
  | {
      readonly status: "awaiting_answer";
      /** 1-based position of the turn currently waiting for an answer. */
      readonly position: number;
      readonly questionCount: number;
    }
  | { readonly status: "generating_report"; readonly questionCount: number }
  | {
      readonly status: "completed";
      readonly questionCount: number;
      readonly hasReport: boolean;
    };

export type MachineEvent =
  | {
      readonly type: "START";
      readonly questionCount: number;
      readonly availableQuestions: number;
    }
  | { readonly type: "SUBMIT_ANSWER" }
  | { readonly type: "REPORT_READY" }
  | { readonly type: "REPORT_FAILED" };

export type RejectionReason =
  | "invalid_question_count"
  | "not_enough_questions"
  | "session_already_started"
  | "session_not_started"
  | "session_already_ended"
  | "not_awaiting_answer"
  | "report_not_pending";

export type TransitionResult =
  | { readonly ok: true; readonly state: MachineState }
  | { readonly ok: false; readonly reason: RejectionReason };

const accept = (state: MachineState): TransitionResult => ({ ok: true, state });
const reject = (reason: RejectionReason): TransitionResult => ({
  ok: false,
  reason,
});

/**
 * Applies `event` to `state`. Pass `null` as the state when no session exists
 * yet, which is the only point at which START is legal.
 */
export function transition(
  state: MachineState | null,
  event: MachineEvent,
): TransitionResult {
  if (event.type === "START") {
    if (state !== null) return reject("session_already_started");
    if (!Number.isInteger(event.questionCount) || event.questionCount < 1) {
      return reject("invalid_question_count");
    }
    if (event.availableQuestions < event.questionCount) {
      return reject("not_enough_questions");
    }
    return accept({
      status: "awaiting_answer",
      position: 1,
      questionCount: event.questionCount,
    });
  }

  if (state === null) return reject("session_not_started");

  switch (state.status) {
    case "awaiting_answer": {
      if (event.type !== "SUBMIT_ANSWER") return reject("report_not_pending");

      // Auto-end: answering the final turn moves straight to report
      // generation. There is no separate "end session" event.
      const nextPosition = state.position + 1;
      if (nextPosition > state.questionCount) {
        return accept({
          status: "generating_report",
          questionCount: state.questionCount,
        });
      }
      return accept({
        status: "awaiting_answer",
        position: nextPosition,
        questionCount: state.questionCount,
      });
    }

    case "generating_report": {
      if (event.type === "SUBMIT_ANSWER") return reject("not_awaiting_answer");
      return accept({
        status: "completed",
        questionCount: state.questionCount,
        // A session whose report failed is still a completed session.
        hasReport: event.type === "REPORT_READY",
      });
    }

    case "completed":
      return reject("session_already_ended");
  }
}

/**
 * Rebuilds the machine state from what the database holds. Never returns
 * `generating_report`, because that state is transient and never stored.
 */
export function stateFromSession(
  session: {
    readonly status: "in_progress" | "completed";
    readonly questionCount: number;
  },
  answeredCount: number,
  hasReport: boolean,
): MachineState {
  if (session.status === "completed") {
    return {
      status: "completed",
      questionCount: session.questionCount,
      hasReport,
    };
  }
  return {
    status: "awaiting_answer",
    position: answeredCount + 1,
    questionCount: session.questionCount,
  };
}
