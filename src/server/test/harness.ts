import { sql } from "drizzle-orm";
import type { TranscriptTurn } from "../ai/prompt";
import { createDatabase, type Database } from "../db";
import { setDependencies } from "../deps";
import { requireEnv } from "../env";

/**
 * Stands in for the real report generator. Integration tests stub at this
 * boundary and never reach the Gemini API.
 */
export function createStubReportGenerator() {
  const stub = {
    calls: [] as ReadonlyArray<TranscriptTurn>[],
    /** Flip to "failure" to exercise the session-with-no-report path. */
    mode: "success" as "success" | "failure",
    content: "Stubbed feedback report.",
    model: "stub-model",
    async generate(turns: ReadonlyArray<TranscriptTurn>) {
      stub.calls.push(turns);
      if (stub.mode === "failure") {
        throw new Error("Stubbed generation failure.");
      }
      return { content: stub.content, model: stub.model };
    },
  };
  return stub;
}

export type StubReportGenerator = ReturnType<typeof createStubReportGenerator>;

export interface Harness {
  readonly db: Database;
  readonly reports: StubReportGenerator;
  readonly truncate: () => Promise<void>;
  readonly close: () => Promise<void>;
}

/**
 * Refuses to run against anything that is not obviously a test database. The
 * dev database holds transcripts worth keeping and this harness truncates.
 */
function testDatabaseUrl(): string {
  const url = requireEnv("TEST_DATABASE_URL");
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against database "${name}": the name must end with _test.`,
    );
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error(
      "Refusing to run integration tests: TEST_DATABASE_URL matches DATABASE_URL.",
    );
  }
  return url;
}

export function startHarness(): Harness {
  const { db, pool } = createDatabase(testDatabaseUrl());
  const reports = createStubReportGenerator();

  // Server functions read their dependencies from this module, so pointing it
  // at the test database is what makes calling them in tests safe.
  setDependencies({ db, reportGenerator: reports });

  return {
    db,
    reports,
    truncate: async () => {
      await db.execute(
        sql`TRUNCATE questions, sessions, turns, reports RESTART IDENTITY CASCADE`,
      );
    },
    close: async () => await pool.end(),
  };
}
