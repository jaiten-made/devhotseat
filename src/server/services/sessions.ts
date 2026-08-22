import { and, asc, count, desc, eq, isNotNull, lte, sql } from "drizzle-orm";
import {
  type StructuredReport,
  structuredReportSchema,
} from "../../lib/report/schema";
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
  readonly questionCount: number;
  readonly answeredCount: number;
  /** 1-based turn awaiting an answer, or null once the session has ended. */
  readonly currentPosition: number | null;
  readonly startedAt: Date;
  /** Null while the interview is still running; the only status there is. */
  readonly endedAt: Date | null;
  readonly turns: ReadonlyArray<SessionTurn>;
  readonly report: {
    readonly content: string;
    /** The scored rubric, or null for a report that is prose only. */
    readonly structured: StructuredReport | null;
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
 * Starts a session over the whole question bank, shuffled, copying each
 * question's text onto its turn and inserting every turn up front with no
 * answer yet. Only an empty bank is refused.
 */
export async function createSession(
  db: Database,
): Promise<CreateSessionResult> {
  const [available] = await db.select({ value: count() }).from(questions);
  const have = available?.value ?? 0;

  const started = transition(null, {
    type: "START",
    availableQuestions: have,
  });
  if (!started.ok) {
    return { ok: false, reason: started.reason, have };
  }

  // The machine decides the length: every question the bank holds.
  const questionCount = started.state.questionCount;

  const sessionId = await db.transaction(async (tx) => {
    const picked = await tx
      .select({ text: questions.text })
      .from(questions)
      // The query builder cannot express ORDER BY random(), so this is raw SQL.
      // No limit: the session is the whole bank, in random order.
      .orderBy(sql`random()`);

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
    .select({
      endedAt: sessions.endedAt,
      questionCount: sessions.questionCount,
    })
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

export type EndSessionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: RejectionReason };

/**
 * Ends a session where it stands, which is what leaving the room does. The
 * report is written on the answers actually given, so walking out after three
 * of five still produces feedback on those three.
 *
 * Ending one that has already ended is a rejection rather than a no-op: two
 * tabs on the same session should not silently overwrite each other's report.
 *
 * Returns null when the session does not exist.
 */
export async function endSession(
  db: Database,
  generator: ReportGenerator,
  sessionId: string,
): Promise<EndSessionResult | null> {
  const [session] = await db
    .select({
      endedAt: sessions.endedAt,
      questionCount: sessions.questionCount,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!session) return null;

  const answeredCount = await countAnswered(db, sessionId);
  const hasReport = await reportExists(db, sessionId);
  const state = stateFromSession(session, answeredCount, hasReport);

  const result = transition(state, { type: "END" });
  if (!result.ok) return { ok: false, reason: result.reason };

  await finishSession(db, generator, sessionId, session.questionCount);
  return { ok: true };
}

/**
 * The terminal transition. Generation failure is not an error: the machine
 * still moves to completed, just without a report row.
 *
 * Only answered turns are sent to the generator. A session ended early has
 * turns that were never asked, and a report judging you on questions you never
 * heard would be worse than no report — which is why no answers at all ends the
 * session without one. The UI already has to render that absence.
 */
async function finishSession(
  db: Database,
  generator: ReportGenerator,
  sessionId: string,
  questionCount: number,
): Promise<void> {
  const rows = await db
    .select({
      position: turns.position,
      questionText: turns.questionText,
      answerText: turns.answerText,
    })
    .from(turns)
    .where(and(eq(turns.sessionId, sessionId), isNotNull(turns.answerText)))
    .orderBy(asc(turns.position));

  let generated: {
    content: string;
    structured: StructuredReport | null;
    model: string;
  } | null = null;
  if (rows.length > 0) {
    try {
      generated = await generator.generate(
        rows.map((row) => ({
          position: row.position,
          questionText: row.questionText,
          answerText: row.answerText ?? "",
        })),
      );
    } catch {
      // A session with no report is a valid state, so swallow this and let the
      // machine record the failure path instead.
      generated = null;
    }
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
        structured: generated.structured,
        model: generated.model,
      });
    }
    await tx
      .update(sessions)
      .set({ endedAt: new Date() })
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
  const running = session.endedAt === null;
  const currentPosition = running ? answeredCount + 1 : null;

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
      structured: reports.structured,
      model: reports.model,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.sessionId, sessionId));

  return {
    id: session.id,
    questionCount: session.questionCount,
    answeredCount,
    currentPosition,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    turns: visibleTurns,
    report: report
      ? { ...report, structured: validateStructured(report.structured) }
      : null,
  };
}

/**
 * Re-checks the stored rubric on the way out. Drizzle's `$type<>()` is only an
 * assertion — nothing validates what is already in the column — so a row
 * written by hand, or under an older shape, would otherwise reach the renderer
 * and break the page. Degrading to prose is the same path a prose-only report
 * already takes.
 */
function validateStructured(value: unknown): StructuredReport | null {
  if (value === null || value === undefined) return null;
  return structuredReportSchema.safeParse(value).data ?? null;
}

export async function listSessions(db: Database) {
  const rows = await db
    .select({
      id: sessions.id,
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

/**
 * Deletes a session and everything hanging off it: its turns and its report go
 * with it through the `ON DELETE CASCADE` on their foreign keys, so this is one
 * statement with no order to get wrong.
 *
 * Running or ended alike, though leaving the room ends a session rather than
 * abandoning it, so a running one only exists in another tab.
 *
 * Returns false when nothing matched, so a stale list can say so.
 */
export async function deleteSession(
  db: Database,
  sessionId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.id, sessionId))
    .returning({ id: sessions.id });
  return deleted.length > 0;
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
