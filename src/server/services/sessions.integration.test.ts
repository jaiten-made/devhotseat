import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { questions, reports, sessions, turns } from "../db";
import { type Harness, startHarness } from "../test/harness";
import { addQuestion, deleteQuestion, listQuestions } from "./questions";
import {
  createSession,
  deleteSession,
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
});

async function seedBank(count: number): Promise<void> {
  for (let i = 1; i <= count; i++) {
    await addQuestion(h.db, `Question ${i}?`);
  }
}

async function start(): Promise<string> {
  const result = await createSession(h.db);
  if (!result.ok) throw new Error(`expected a session, got ${result.reason}`);
  return result.sessionId;
}

const answer = (id: string, text: string) =>
  submitAnswer(h.db, h.reports, id, text);

describe("starting a session", () => {
  it("is refused only when the bank is empty", async () => {
    const result = await createSession(h.db);
    expect(result).toMatchObject({
      ok: false,
      reason: "empty_question_bank",
      have: 0,
    });

    expect(await h.db.select().from(sessions)).toHaveLength(0);
    expect(await h.db.select().from(turns)).toHaveLength(0);
  });

  it("starts on a single question and ends after one answer", async () => {
    await seedBank(1);
    const id = await start();

    const [row] = await h.db.select().from(sessions).where(eq(sessions.id, id));
    expect(row?.questionCount).toBe(1);
    expect(await h.db.select().from(turns)).toHaveLength(1);

    await answer(id, "My only answer.");
    const detail = await getSessionDetail(h.db, id);
    expect(detail?.status).toBe("completed");
    expect(detail?.turns).toHaveLength(1);
    expect(detail?.report).not.toBeNull();
  });

  it("is exactly as long as the bank, however big the bank is", async () => {
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
    expect(row?.status).toBe("in_progress");
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
      expect(detail?.status).toBe("in_progress");
      expect(detail?.endedAt).toBeNull();
      // Still running, so no report has been asked for.
      expect(h.reports.calls).toHaveLength(0);
    }

    await answer(id, "Final answer");
    const ended = await getSessionDetail(h.db, id);
    expect(ended?.status).toBe("completed");
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

describe("the transcript and report", () => {
  it("runs the whole journey and reads back", async () => {
    await seedBank(N);
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    const detail = await getSessionDetail(h.db, id);
    expect(detail?.status).toBe("completed");
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
  });

  it("still saves the session and transcript when generation fails", async () => {
    await seedBank(N);
    h.reports.mode = "failure";
    const id = await start();
    for (let i = 1; i <= N; i++) await answer(id, `Answer ${i}`);

    const detail = await getSessionDetail(h.db, id);
    expect(detail?.status).toBe("completed");
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
      status: "completed",
      questionCount: N,
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
