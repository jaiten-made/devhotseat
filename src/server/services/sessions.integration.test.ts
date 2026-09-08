import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { questions, reports, sessions, turns } from "../db";
import { type Harness, startHarness } from "../test/harness";
import { addQuestion, deleteQuestion, listQuestions } from "./questions";
import {
  createSession,
  deleteSession,
  endSession,
  getSessionDetail,
  listSessions,
  submitAnswer,
} from "./sessions";

const N = 3; // session length under test
let h: Harness;

beforeAll(() => {
  h = startHarness();
});
afterAll(async () => await h.close());
beforeEach(async () => {
  await h.truncate();
  h.reports.mode = "success";
  h.reports.calls.length = 0;
  h.reports.structured = null;
});

async function seedBank(count: number): Promise<void> {
  for (let i = 1; i <= count; i++) {
    await addQuestion(h.db, `Question ${i}?`);
  }
}

/**
 * Starts a session over the whole bank, which is what most of these specs are
 * about. Pass ids to start one over a narrower pick.
 */
async function start(questionIds?: readonly string[]): Promise<string> {
  const ids = questionIds ?? (await bankIds());
  const result = await createSession(h.db, ids);
  if (!result.ok) throw new Error(`expected a session, got ${result.reason}`);
  return result.sessionId;
}

const bankIds = async (): Promise<string[]> =>
  (await listQuestions(h.db)).map((question) => question.id);

const answer = (id: string, text: string) =>
  submitAnswer(h.db, h.reports, id, text);

/** Leaving the room. */
const end = (id: string) => endSession(h.db, h.reports, id);

describe("starting a session", () => {
  it("is refused when nothing is picked", async () => {
    await seedBank(N);
    const result = await createSession(h.db, []);
    expect(result).toMatchObject({
      ok: false,
      reason: "no_questions_selected",
    });

    expect(await h.db.select().from(sessions)).toHaveLength(0);
    expect(await h.db.select().from(turns)).toHaveLength(0);
  });

  // Every id picked had been deleted by the time the session was created,
  // which leaves nothing to ask. Same refusal as picking nothing at all.
  it("is refused when none of the picked questions are still there", async () => {
    await seedBank(1);
    const [id] = await bankIds();
    if (!id) throw new Error("expected a seeded question");
    await deleteQuestion(h.db, id);

    expect(await createSession(h.db, [id])).toMatchObject({
      ok: false,
      reason: "no_questions_selected",
    });
    expect(await h.db.select().from(sessions)).toHaveLength(0);
  });

  it("asks the questions picked and no others", async () => {
    await seedBank(5);
    const bank = await listQuestions(h.db);
    const picked = bank.slice(0, 2);
    const id = await start(picked.map((question) => question.id));

    const [row] = await h.db.select().from(sessions).where(eq(sessions.id, id));
    expect(row?.questionCount).toBe(2);

    const rows = await h.db.select().from(turns).where(eq(turns.sessionId, id));
    expect(rows.map((turn) => turn.questionText).sort()).toEqual(
      picked.map((question) => question.text).sort(),
    );
  });

  it("collapses a question picked twice into one turn", async () => {
    await seedBank(1);
    const [questionId] = await bankIds();
    if (!questionId) throw new Error("expected a seeded question");
    const id = await start([questionId, questionId]);

    const [row] = await h.db.select().from(sessions).where(eq(sessions.id, id));
    expect(row?.questionCount).toBe(1);
    expect(await h.db.select().from(turns)).toHaveLength(1);
  });

  // A picker drawn before the question was deleted. The session is as long as
  // the bank could actually supply, rather than carrying an empty turn.
  it("skips a picked question that has since been deleted", async () => {
    await seedBank(3);
    const bank = await listQuestions(h.db);
    const gone = bank[0];
    if (!gone) throw new Error("expected a seeded question");
    await deleteQuestion(h.db, gone.id);

    const result = await createSession(
      h.db,
      bank.map((question) => question.id),
    );
    expect(result).toMatchObject({ ok: true, questionCount: 2 });
    if (!result.ok) return;

    const rows = await h.db
      .select()
      .from(turns)
      .where(eq(turns.sessionId, result.sessionId));
    expect(rows).toHaveLength(2);
    expect(rows.map((turn) => turn.questionText)).not.toContain(gone.text);
  });

  it("starts on a single question and ends after one answer", async () => {
    await seedBank(1);
    const id = await start();

    const [row] = await h.db.select().from(sessions).where(eq(sessions.id, id));
    expect(row?.questionCount).toBe(1);
    expect(await h.db.select().from(turns)).toHaveLength(1);

    await answer(id, "My only answer.");
    const detail = await getSessionDetail(h.db, id);
    expect(detail?.endedAt).not.toBeNull();
    expect(detail?.turns).toHaveLength(1);
    expect(detail?.report).not.toBeNull();
  });

  it("is exactly as long as the pick, however big the pick is", async () => {
    await seedBank(8);
    const id = await start();

    const [row] = await h.db.select().from(sessions).where(eq(sessions.id, id));
    expect(row?.questionCount).toBe(8);

    const rows = await h.db
      .select()
      .from(turns)
      .where(eq(turns.sessionId, id))
      .orderBy(asc(turns.position));
    expect(rows).toHaveLength(8);
    // Every question appears exactly once, shuffled rather than sampled.
    expect(new Set(rows.map((r) => r.questionText)).size).toBe(8);
  });

  it("creates every turn up front, in order, unanswered", async () => {
    await seedBank(N);
    const id = await start();

    const rows = await h.db
      .select()
      .from(turns)
      .where(eq(turns.sessionId, id))
      .orderBy(asc(turns.position));

    expect(rows).toHaveLength(N);
    expect(rows.map((t) => t.position)).toEqual([1, 2, 3]);
    expect(rows.every((t) => t.answerText === null)).toBe(true);
    // Every question, each exactly once.
    expect(new Set(rows.map((t) => t.questionText)).size).toBe(N);
  });

  it("snapshots the question count onto the session", async () => {
    await seedBank(N);
    const id = await start();
    const [row] = await h.db.select().from(sessions).where(eq(sessions.id, id));
    expect(row?.questionCount).toBe(N);
    // Running or ended is `ended_at` and nothing else.
    expect(row?.endedAt).toBeNull();
  });

  it("does not hand back questions that have not been asked yet", async () => {
    await seedBank(N);
    const id = await start();

    const detail = await getSessionDetail(h.db, id);
    expect(detail?.turns).toHaveLength(1);
    expect(detail?.currentPosition).toBe(1);
    expect(detail?.answeredCount).toBe(0);
  });
});

describe("answering turn by turn", () => {
  it("persists answers in order", async () => {
    await seedBank(N);
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    const rows = await h.db
      .select()
      .from(turns)
      .where(eq(turns.sessionId, id))
      .orderBy(asc(turns.position));

    expect(rows.map((t) => t.answerText)).toEqual([
      "Answer 1",
      "Answer 2",
      "Answer 3",
    ]);
    expect(rows.every((t) => t.answeredAt !== null)).toBe(true);
  });

  it("ends on the last answer and not before", async () => {
    await seedBank(N);
    const id = await start();

    for (let i = 1; i < N; i++) {
      await answer(id, `Answer ${i}`);
      const detail = await getSessionDetail(h.db, id);
      expect(detail?.endedAt).toBeNull();
      // Still running, so no report has been asked for.
      expect(h.reports.calls).toHaveLength(0);
    }

    await answer(id, "Final answer");
    const ended = await getSessionDetail(h.db, id);
    expect(ended?.endedAt).not.toBeNull();
    expect(ended?.currentPosition).toBeNull();
    expect(h.reports.calls).toHaveLength(1);
  });

  it("refuses a further answer once the session has ended", async () => {
    await seedBank(N);
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    expect(await answer(id, "One more")).toEqual({
      ok: false,
      reason: "session_already_ended",
    });

    const rows = await h.db.select().from(turns).where(eq(turns.sessionId, id));
    expect(rows).toHaveLength(N);
    expect(rows.some((t) => t.answerText === "One more")).toBe(false);
  });

  it("refuses a blank answer and reports an unknown session", async () => {
    await seedBank(N);
    const id = await start();
    await expect(answer(id, "   ")).rejects.toThrow(/cannot be blank/i);
    expect(
      await answer("11111111-1111-1111-1111-111111111111", "Hello"),
    ).toBeNull();
  });
});

describe("ending early", () => {
  it("ends a part-answered session and reports on what was answered", async () => {
    await seedBank(N);
    const id = await start();
    await answer(id, "Answer 1");

    expect(await end(id)).toEqual({ ok: true });

    const detail = await getSessionDetail(h.db, id);
    expect(detail?.endedAt).not.toBeNull();
    expect(detail?.currentPosition).toBeNull();
    expect(detail?.answeredCount).toBe(1);
    // The whole transcript is readable once it is over, unanswered turns and
    // all: they are what "ended early" looks like.
    expect(detail?.turns).toHaveLength(N);
    expect(detail?.report).not.toBeNull();

    // Only the answered turn was sent to be marked. A report judging you on
    // questions you never heard would be worse than no report.
    const [passed] = h.reports.calls;
    expect(passed).toHaveLength(1);
    expect(passed?.map((t) => t.answerText)).toEqual(["Answer 1"]);
    expect(passed?.map((t) => t.position)).toEqual([1]);
  });

  it("ends a session with no answers, and writes no report", async () => {
    await seedBank(N);
    const id = await start();

    expect(await end(id)).toEqual({ ok: true });

    const detail = await getSessionDetail(h.db, id);
    expect(detail?.endedAt).not.toBeNull();
    expect(detail?.report).toBeNull();
    expect(h.reports.calls).toHaveLength(0);
    expect(await h.db.select().from(reports)).toHaveLength(0);
  });

  it("refuses a further answer once it has been left", async () => {
    await seedBank(N);
    const id = await start();
    await end(id);

    expect(await answer(id, "One more")).toEqual({
      ok: false,
      reason: "session_already_ended",
    });
  });

  it("refuses to end the same session twice", async () => {
    await seedBank(N);
    const id = await start();
    await answer(id, "Answer 1");
    await end(id);

    expect(await end(id)).toEqual({
      ok: false,
      reason: "session_already_ended",
    });
    // The second attempt must not overwrite the first report.
    expect(await h.db.select().from(reports)).toHaveLength(1);
  });

  it("does not end a session that already ended by itself", async () => {
    await seedBank(1);
    const id = await start();
    await answer(id, "My only answer.");

    expect(await end(id)).toEqual({
      ok: false,
      reason: "session_already_ended",
    });
  });

  it("reports an unknown session", async () => {
    expect(await end("11111111-1111-1111-1111-111111111111")).toBeNull();
  });

  it("leaves nothing running in the list", async () => {
    await seedBank(N);
    const id = await start();
    await answer(id, "Answer 1");
    await end(id);

    const listed = await listSessions(h.db);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id, answeredCount: 1, hasReport: true });
    expect(listed[0]?.endedAt).not.toBeNull();
  });
});

describe("the transcript and report", () => {
  it("runs the whole journey and reads back", async () => {
    await seedBank(N);
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    const detail = await getSessionDetail(h.db, id);
    expect(detail?.endedAt).not.toBeNull();
    expect(detail?.turns).toHaveLength(N);
    expect(detail?.turns.map((t) => t.position)).toEqual([1, 2, 3]);
    expect(detail?.report).toMatchObject({
      content: "Stubbed feedback report.",
      model: "stub-model",
    });

    const [row] = await h.db
      .select()
      .from(reports)
      .where(eq(reports.sessionId, id));
    expect(row?.content).toBe("Stubbed feedback report.");
  });

  it("round-trips the scored rubric through the jsonb column", async () => {
    await seedBank(N);
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    const detail = await getSessionDetail(h.db, id);
    const structured = detail?.report?.structured;
    expect(structured?.turns).toHaveLength(N);
    expect(structured?.turns.map((t) => t.position)).toEqual([1, 2, 3]);
    // Scores survive as numbers, not as the strings JSON round-trips can leave.
    for (const turn of structured?.turns ?? []) {
      expect(typeof turn.action.score).toBe("number");
      expect(turn.action.score).toBeGreaterThanOrEqual(1);
      expect(turn.action.score).toBeLessThanOrEqual(4);
    }
    expect(structured?.headline).toBe("Stubbed headline.");
  });

  it("writes a prose-only report when the rubric did not survive", async () => {
    await seedBank(N);
    h.reports.mode = "prose_only";
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    const detail = await getSessionDetail(h.db, id);
    // Prose alone is still a report: the session completed and the row exists.
    expect(detail?.endedAt).not.toBeNull();
    expect(detail?.report?.content).toBe("Stubbed feedback report.");
    expect(detail?.report?.structured).toBeNull();

    const [row] = await h.db
      .select()
      .from(reports)
      .where(eq(reports.sessionId, id));
    expect(row?.structured).toBeNull();
  });

  // Drizzle's $type<>() is an assertion, not a check. A row that predates the
  // current shape must degrade to prose rather than break the page.
  it("degrades a stored rubric it cannot validate back to prose", async () => {
    await seedBank(N);
    h.reports.mode = "prose_only";
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    await h.db
      .update(reports)
      .set({ structured: { turns: "nope" } as never })
      .where(eq(reports.sessionId, id));

    const detail = await getSessionDetail(h.db, id);
    expect(detail?.report?.structured).toBeNull();
    expect(detail?.report?.content).toBe("Stubbed feedback report.");
  });

  it("hands the full transcript to the generator", async () => {
    await seedBank(N);
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    const [passed] = h.reports.calls;
    expect(passed).toHaveLength(N);
    expect(passed?.map((t) => t.answerText)).toEqual([
      "Answer 1",
      "Answer 2",
      "Answer 3",
    ]);
    // The position travels with each turn so the scores can be joined back to
    // the questions they were given for.
    expect(passed?.map((t) => t.position)).toEqual([1, 2, 3]);
  });

  it("still saves the session and transcript when generation fails", async () => {
    await seedBank(N);
    h.reports.mode = "failure";
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    const detail = await getSessionDetail(h.db, id);
    expect(detail?.endedAt).not.toBeNull();
    expect(detail?.report).toBeNull();
    expect(detail?.turns).toHaveLength(N);
    expect(await h.db.select().from(reports)).toHaveLength(0);
  });

  it("lists sessions with their progress", async () => {
    await seedBank(N);
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    const listed = await listSessions(h.db);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id,
      answeredCount: N,
      hasReport: true,
    });
  });

  it("returns null for an unknown session", async () => {
    expect(
      await getSessionDetail(h.db, "11111111-1111-1111-1111-111111111111"),
    ).toBeNull();
  });
});

describe("deleting a question", () => {
  it("leaves an existing transcript untouched", async () => {
    await seedBank(N);
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    const before = await getSessionDetail(h.db, id);

    // Empty the entire bank the session was built from.
    for (const question of await listQuestions(h.db)) {
      expect(await deleteQuestion(h.db, question.id)).toBe(true);
    }
    expect(await h.db.select().from(questions)).toHaveLength(0);

    const after = await getSessionDetail(h.db, id);
    expect(after?.turns).toEqual(before?.turns);
    expect(after?.report).toEqual(before?.report);
    expect(after?.turns.every((t) => t.questionText.length > 0)).toBe(true);
  });
});

describe("deleting a session", () => {
  it("takes its turns and its report with it", async () => {
    await seedBank(N);
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    // Everything the session owns exists first, or the assertions below would
    // pass against a session that was never populated.
    expect(await h.db.select().from(turns)).toHaveLength(N);
    expect(await h.db.select().from(reports)).toHaveLength(1);

    expect(await deleteSession(h.db, id)).toBe(true);

    expect(await h.db.select().from(sessions)).toHaveLength(0);
    expect(await h.db.select().from(turns)).toHaveLength(0);
    expect(await h.db.select().from(reports)).toHaveLength(0);
    expect(await getSessionDetail(h.db, id)).toBeNull();
    expect(await listSessions(h.db)).toHaveLength(0);
  });

  it("deletes an in-progress session part way through", async () => {
    await seedBank(N);
    const id = await start();
    await answer(id, "Only answer");

    expect(await deleteSession(h.db, id)).toBe(true);
    expect(await h.db.select().from(turns)).toHaveLength(0);
  });

  it("leaves the question bank and other sessions alone", async () => {
    await seedBank(N);
    const doomed = await start();
    for (let i = 1; i <= N; i++) await answer(doomed, `Answer ${i}`);
    const kept = await start();
    await answer(kept, "Kept answer");

    expect(await deleteSession(h.db, doomed)).toBe(true);

    expect(await h.db.select().from(questions)).toHaveLength(N);
    const survivor = await getSessionDetail(h.db, kept);
    expect(survivor?.id).toBe(kept);
    expect(survivor?.answeredCount).toBe(1);
    expect(await h.db.select().from(turns)).toHaveLength(N);
  });

  it("reports false for an unknown session and deletes nothing", async () => {
    await seedBank(N);
    const id = await start();

    expect(
      await deleteSession(h.db, "11111111-1111-1111-1111-111111111111"),
    ).toBe(false);
    expect(await getSessionDetail(h.db, id)).not.toBeNull();
  });
});
