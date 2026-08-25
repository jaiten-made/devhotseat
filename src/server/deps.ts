import {
  createGeminiReportGenerator,
  createLocalReportGenerator,
  type ReportGenerator,
} from "./ai/client";
import { createStubReportGenerator } from "./ai/stub";
import { createDatabase, type Database } from "./db";
import { type AIProvider, loadEnv } from "./env";

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

export function resolveAiProvider(preference?: AIProvider): AIProvider {
  if (preference) return preference;
  const env = loadEnv();
  if (env.AI_PROVIDER) return env.AI_PROVIDER;
  if (env.GEMINI_API_KEY.trim() !== "") return "gemini";
  return "local";
}

export function getReportGenerator(preference?: AIProvider): ReportGenerator {
  if (reportGenerator) {
    return reportGenerator;
  }
  if (process.env.HOTSEAT_STUB_REPORTS === "1") {
    reportGenerator = createStubReportGenerator();
    return reportGenerator;
  }

  const env = loadEnv();
  const provider = resolveAiProvider(preference);

  if (provider === "gemini") {
    if (env.GEMINI_API_KEY.trim() === "") {
      throw new Error(
        "GEMINI_API_KEY is not configured in .env. Switch to Local AI or provide a Gemini API key.",
      );
    }
    return createGeminiReportGenerator({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
    });
  }

  return createLocalReportGenerator({
    baseUrl: env.LOCAL_AI_BASE_URL,
    model: env.LOCAL_AI_MODEL,
  });
}
