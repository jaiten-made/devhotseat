import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { questions } from "../db";
import { type Harness, startHarness } from "../test/harness";
import {
  addQuestion,
  countQuestions,
  deleteQuestion,
  listQuestions,
} from "./questions";

let h: Harness;

beforeAll(() => {
  h = startHarness();
});
afterAll(async () => await h.close());
beforeEach(async () => await h.truncate());

describe("the question bank", () => {
  it("adds a question and persists the row", async () => {
    const created = await addQuestion(h.db, "Why this role?");
    expect(created.text).toBe("Why this role?");

    const rows = await h.db.select().from(questions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(created.id);
  });

  it("lists what was added and counts it", async () => {
    await addQuestion(h.db, "First");
    await addQuestion(h.db, "Second");

    const listed = await listQuestions(h.db);
    expect(listed.map((q) => q.text).sort()).toEqual(["First", "Second"]);
    expect(await countQuestions(h.db)).toBe(2);
  });

  it("reads back empty when nothing has been added", async () => {
    expect(await listQuestions(h.db)).toEqual([]);
    expect(await countQuestions(h.db)).toBe(0);
  });

  it("trims the text and refuses a blank question", async () => {
    expect((await addQuestion(h.db, "  Padded?  ")).text).toBe("Padded?");
    await expect(addQuestion(h.db, "   ")).rejects.toThrow(/cannot be blank/i);
    expect(await countQuestions(h.db)).toBe(1);
  });

  it("deletes a question and reports whether anything matched", async () => {
    const created = await addQuestion(h.db, "Doomed");
    expect(await deleteQuestion(h.db, created.id)).toBe(true);
    expect(await h.db.select().from(questions)).toHaveLength(0);

    expect(
      await deleteQuestion(h.db, "11111111-1111-1111-1111-111111111111"),
    ).toBe(false);
  });
});
