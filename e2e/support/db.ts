import { config } from "dotenv";
import { Pool } from "pg";

config();

/**
 * Direct database access for the specs, used only to reset state and to seed
 * the one case the UI cannot produce on demand: a completed session whose
 * report generation failed.
 */
function pool(): Pool {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("TEST_DATABASE_URL is not set.");
  if (!new URL(connectionString).pathname.endsWith("_test")) {
    throw new Error("Refusing to run e2e against a database not named *_test.");
  }
  return new Pool({ connectionString });
}

export async function resetDatabase(): Promise<void> {
  const p = pool();
  try {
    await p.query(
      "TRUNCATE questions, sessions, turns, reports RESTART IDENTITY CASCADE",
    );
  } finally {
    await p.end();
  }
}

/** A finished session with a full transcript and no report row. */
export async function seedSessionWithoutReport(): Promise<string> {
  const p = pool();
  try {
    const session = await p.query<{ id: string }>(
      "INSERT INTO sessions (question_count, status, ended_at) VALUES (2, 'completed', now()) RETURNING id",
    );
    const id = session.rows[0]?.id;
    if (!id) throw new Error("Failed to seed a session.");
    await p.query(
      `INSERT INTO turns (session_id, position, question_text, answer_text, answered_at)
       VALUES ($1, 1, 'Seeded question one?', 'Seeded answer one.', now()),
              ($1, 2, 'Seeded question two?', 'Seeded answer two.', now())`,
      [id],
    );
    return id;
  } finally {
    await p.end();
  }
}
