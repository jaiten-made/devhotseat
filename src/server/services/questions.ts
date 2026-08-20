import { count, desc, eq } from "drizzle-orm";
import { type Database, questions } from "../db";

export function listQuestions(db: Database) {
  return db.select().from(questions).orderBy(desc(questions.createdAt));
}

export async function countQuestions(db: Database): Promise<number> {
  const [row] = await db.select({ value: count() }).from(questions);
  return row?.value ?? 0;
}

export async function addQuestion(db: Database, text: string) {
  const trimmed = text.trim();
  if (trimmed === "") {
    throw new Error("A question cannot be blank.");
  }
  const [row] = await db
    .insert(questions)
    .values({ text: trimmed })
    .returning();
  if (!row) throw new Error("Insert returned no question row.");
  return row;
}

/** Returns false when nothing matched, which the route turns into a 404. */
export async function deleteQuestion(
  db: Database,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(questions)
    .where(eq(questions.id, id))
    .returning({ id: questions.id });
  return deleted.length > 0;
}
