import { and, asc, count, desc, eq, isNotNull, lte, sql } from "drizzle-orm";
import type { ReportGenerator } from "../ai/client";
import { type Database, questions, reports, sessions, turns } from "../db";
import {
  type RejectionReason,
  stateFromSession,
  transition,
} from "../session/machine";

export interface SessionTurn {
  readonly position: number;
  readonly questionText: string;
  readonly answerText: string | null;
  readonly answeredAt: Date | null;
}

export interface SessionDetail {
  readonly id: string;
  readonly status: "in_progress" | "completed";
  readonly questionCount: number;
  readonly answeredCount: number;
  /** 1-based turn awaiting an answer, or null once the session has ended. */
  readonly currentPosition: number | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly turns: ReadonlyArray<SessionTurn>;
  readonly report: {
    readonly content: string;
    readonly model: string;
    readonly createdAt: Date;
  } | null;
}

export type CreateSessionResult =
  | { readonly ok: true; readonly sessionId: string }
  | {
      readonly ok: false;
      readonly reason: RejectionReason;
      readonly have: number;
    };

/**
 * Starts a session: picks its questions at random, copies their text onto the
 * turns, and inserts every turn up front with no answer yet.
 *
 * `sessionLength` is a maximum. A bank holding fewer than that yields a shorter
 * session; only an empty bank is refused.
 */
export async function createSession(
  db: Database,
  sessionLength: number,
): Promise<CreateSessionResult> {
  const [available] = await db.select({ value: count() }).from(questions);
  const have = available?.value ?? 0;

  const started = transition(null, {
    type: "START",
    questionCount: sessionLength,
    availableQuestions: have,
  });
  if (!started.ok) {
    return { ok: false, reason: started.reason, have };
  }

  // The machine decides the length, capping it at what the bank can supply.
  const questionCount = started.state.questionCount;

  const sessionId = await db.transaction(async (tx) => {
    const picked = await tx
      .select({ text: questions.text })
      .from(questions)
      // The query builder cannot express ORDER BY random(), so this is raw SQL.
      .orderBy(sql`random()`)
      .limit(questionCount);

    const [session] = await tx
      .insert(sessions)
      .values({ questionCount })
      .returning({ id: sessions.id });
    if (!session) throw new Error("Insert returned no session row.");

    await tx.insert(turns).values(
      picked.map((question, index) => ({
        sessionId: session.id,
        position: index + 1,
        questionText: question.text,
      })),
    );
    return session.id;
  });

  return { ok: true, sessionId };
}

export type SubmitAnswerResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: RejectionReason };

/**
 * Records an answer. Submitting the final one auto-ends the session and
 * triggers report generation, both decided by the state machine.
 *
 * Returns null when the session does not exist.
 */
export async function submitAnswer(
  db: Database,
  generator: ReportGenerator,
  sessionId: string,
  answerText: string,
): Promise<SubmitAnswerResult | null> {
  const trimmed = answerText.trim();
  if (trimmed === "") {
    throw new Error("An answer cannot be blank.");
  }

  const [session] = await db
    .select({ status: sessions.status, questionCount: sessions.questionCount })
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!session) return null;

  const answeredCount = await countAnswered(db, sessionId);
  const hasReport = await reportExists(db, sessionId);
  const state = stateFromSession(session, answeredCount, hasReport);

  const result = transition(state, { type: "SUBMIT_ANSWER" });
  if (!result.ok) return { ok: false, reason: result.reason };

  await db
    .update(turns)
    .set({ answerText: trimmed, answeredAt: new Date() })
    .where(
      and(
        eq(turns.sessionId, sessionId),
        eq(turns.position, answeredCount + 1),
      ),
    );

  if (result.state.status === "generating_report") {
    await finishSession(db, generator, sessionId, session.questionCount);
  }
  return { ok: true };
}

/**
 * The terminal transition. Generation failure is not an error: the machine
 * still moves to completed, just without a report row.
 */
async function finishSession(
  db: Database,
  generator: ReportGenerator,
  sessionId: string,
  questionCount: number,
): Promise<void> {
  const rows = await db
    .select({
      questionText: turns.questionText,
      answerText: turns.answerText,
    })
    .from(turns)
    .where(eq(turns.sessionId, sessionId))
    .orderBy(asc(turns.position));

  let generated: { content: string; model: string } | null = null;
  try {
    generated = await generator.generate(
      rows.map((row) => ({
        questionText: row.questionText,
        answerText: row.answerText ?? "",
      })),
    );
  } catch {
    // A session with no report is a valid state, so swallow this and let the
    // machine record the failure path instead.
    generated = null;
  }

  const ended = transition(
    { status: "generating_report", questionCount },
    generated ? { type: "REPORT_READY" } : { type: "REPORT_FAILED" },
  );
  if (!ended.ok) {
    throw new Error("State machine refused to end a session after its report.");
  }
  const finalState = ended.state;
  if (finalState.status !== "completed") {
    throw new Error(`Expected a completed session, got ${finalState.status}.`);
  }

  await db.transaction(async (tx) => {
    if (generated) {
      await tx.insert(reports).values({
        sessionId,
        content: generated.content,
        model: generated.model,
      });
    }
    await tx
      .update(sessions)
      .set({ status: finalState.status, endedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  });
}

export async function getSessionDetail(
  db: Database,
  sessionId: string,
): Promise<SessionDetail | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!session) return null;

  const answeredCount = await countAnswered(db, sessionId);
  const inProgress = session.status === "in_progress";
  const currentPosition = inProgress ? answeredCount + 1 : null;

  // While a session is running, only turns up to and including the current one
  // are returned. Later questions are chosen already, but handing them to the
  // client would let the next question be read ahead of being asked.
  const visibleTurns = await db
    .select({
      position: turns.position,
      questionText: turns.questionText,
      answerText: turns.answerText,
      answeredAt: turns.answeredAt,
    })
    .from(turns)
    .where(
      currentPosition === null
        ? eq(turns.sessionId, sessionId)
        : and(
            eq(turns.sessionId, sessionId),
            lte(turns.position, currentPosition),
          ),
    )
    .orderBy(asc(turns.position));

  const [report] = await db
    .select({
      content: reports.content,
      model: reports.model,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.sessionId, sessionId));

  return {
    id: session.id,
    status: session.status,
    questionCount: session.questionCount,
    answeredCount,
    currentPosition,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    turns: visibleTurns,
    report: report ?? null,
  };
}

export async function listSessions(db: Database) {
  const rows = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      questionCount: sessions.questionCount,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      answeredCount: count(turns.answeredAt),
      reportId: reports.id,
    })
    .from(sessions)
    .leftJoin(
      turns,
      and(eq(turns.sessionId, sessions.id), isNotNull(turns.answeredAt)),
    )
    .leftJoin(reports, eq(reports.sessionId, sessions.id))
    .groupBy(sessions.id, reports.id)
    .orderBy(desc(sessions.startedAt));

  return rows.map(({ reportId, ...rest }) => ({
    ...rest,
    hasReport: reportId !== null,
  }));
}

async function countAnswered(db: Database, sessionId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(turns)
    .where(and(eq(turns.sessionId, sessionId), isNotNull(turns.answerText)));
  return row?.value ?? 0;
}

async function reportExists(db: Database, sessionId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.sessionId, sessionId));
  return row !== undefined;
}
