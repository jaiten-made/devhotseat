import { sql } from "drizzle-orm";
import type { StructuredReport } from "../../lib/report/schema";
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
    /**
     * "failure" exercises the session-with-no-report path; "prose_only" the
     * model that wrote usable prose but an unusable rubric.
     */
    mode: "success" as "success" | "failure" | "prose_only",
    content: "Stubbed feedback report.",
    model: "stub-model",
    /** Overwritten per test to assert on specific scores. */
    structured: null as StructuredReport | null,
    async generate(turns: ReadonlyArray<TranscriptTurn>) {
      stub.calls.push(turns);
      if (stub.mode === "failure") {
        throw new Error("Stubbed generation failure.");
      }
      const structured =
        stub.mode === "prose_only"
          ? null
          : (stub.structured ?? stubScores(turns, stub.content));
      return { content: stub.content, structured, model: stub.model };
    },
  };
  return stub;
}

/** A valid rubric over whatever turns were sent, so positions always line up. */
function stubScores(
  turns: ReadonlyArray<TranscriptTurn>,
  narrative: string,
): StructuredReport {
  return {
    turns: turns.map((turn, index) => {
      const pillar = (offset: number) => ({
        score: ((index + offset) % 4) + 1,
        evidence: `Stubbed evidence for question ${turn.position}.`,
      });
      return {
        position: turn.position,
        situation: pillar(0),
        task: pillar(1),
        action: pillar(2),
        result: pillar(3),
        learning: pillar(1),
        strength: `Stubbed strength for question ${turn.position}.`,
        improvement: `Stubbed improvement for question ${turn.position}.`,
      };
    }),
    headline: "Stubbed headline.",
    narrative,
  };
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
