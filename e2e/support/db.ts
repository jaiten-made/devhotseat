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

/**
 * A finished session with a full transcript and no report row. `ended_at` is
 * what makes it finished — there is no status column.
 */
export async function seedSessionWithoutReport(): Promise<string> {
  const p = pool();
  try {
    const session = await p.query<{ id: string }>(
      "INSERT INTO sessions (question_count, ended_at) VALUES (2, now()) RETURNING id",
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

/**
 * A finished session whose report is prose only, with no scored rubric — what
 * every report written before scoring existed looks like. Seeded rather than
 * driven through the UI because the stub always returns a full rubric.
 */
export async function seedSessionWithProseOnlyReport(): Promise<string> {
  const p = pool();
  try {
    const session = await p.query<{ id: string }>(
      "INSERT INTO sessions (question_count, ended_at) VALUES (1, now()) RETURNING id",
    );
    const id = session.rows[0]?.id;
    if (!id) throw new Error("Failed to seed a session.");
    await p.query(
      `INSERT INTO turns (session_id, position, question_text, answer_text, answered_at)
       VALUES ($1, 1, 'Seeded question one?', 'Seeded answer one.', now())`,
      [id],
    );
    await p.query(
      `INSERT INTO reports (session_id, content, model, structured)
       VALUES ($1, 'This report is prose only, written before scoring existed.', 'legacy-model', NULL)`,
      [id],
    );
    return id;
  } finally {
    await p.end();
  }
}

/**
 * Practice history on chosen days, for the dashboard's heatmap.
 *
 * Each entry is one session that many days ago, answered in full, so listing
 * the same day twice is a day that held two sessions. `now()` minus an
 * interval keeps the clock time and moves the date, which is what makes the
 * seeded day land on the local day the browser will bucket it into.
 */
export async function seedPractice(
  daysAgo: ReadonlyArray<number>,
  answersPerSession = 2,
): Promise<void> {
  const p = pool();
  try {
    for (const offset of daysAgo) {
      const session = await p.query<{ id: string }>(
        `INSERT INTO sessions (question_count, started_at, ended_at)
         VALUES ($1, now() - ($2 || ' days')::interval, now() - ($2 || ' days')::interval)
         RETURNING id`,
        [answersPerSession, offset],
      );
      const id = session.rows[0]?.id;
      if (!id) throw new Error("Failed to seed a session.");
      for (let position = 1; position <= answersPerSession; position += 1) {
        await p.query(
          `INSERT INTO turns (session_id, position, question_text, answer_text, answered_at)
           VALUES ($1, $2, $3, $4, now() - ($5 || ' days')::interval)`,
          [
            id,
            position,
            `Seeded question ${position}?`,
            `Seeded answer ${position}.`,
            offset,
          ],
        );
      }
    }
  } finally {
    await p.end();
  }
}
