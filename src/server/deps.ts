import { createGeminiReportGenerator, type ReportGenerator } from "./ai/client";
import { createDatabase, type Database } from "./db";
import { loadEnv } from "./env";

let database: Database | undefined;
let reportGenerator: ReportGenerator | undefined;

/**
 * Lazily built singletons. Server functions reach for these rather than taking
 * dependencies as parameters; the services underneath still take them as
 * arguments, which is what lets the tests supply a test database and a stub.
 */
/**
 * Point the singletons at a test database and a stubbed generator. Called by
 * the integration harness before any server function runs.
 */
export function setDependencies(deps: {
  db: Database;
  reportGenerator: ReportGenerator;
}): void {
  database = deps.db;
  reportGenerator = deps.reportGenerator;
}

export function getDb(): Database {
  if (!database) {
    database = createDatabase(loadEnv().DATABASE_URL).db;
  }
  return database;
}

export function getReportGenerator(): ReportGenerator {
  if (!reportGenerator) {
    reportGenerator = createGeminiReportGenerator({
      apiKey: loadEnv().GEMINI_API_KEY,
    });
  }
  return reportGenerator;
}
