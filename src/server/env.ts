import { config } from "dotenv";
import { z } from "zod";

// Loads .env from the working directory, which is the repo root for both
// `pnpm dev` and the test runners.
config();

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
});

/**
 * Validated environment. Throws with the names of the missing variables rather
 * than letting `undefined` reach the database driver or the AI client and fail
 * as something more confusing later.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Environment is not configured.\n${problems}\nCopy .env.example to .env and fill it in.`,
    );
  }
  return result.data;
}

/** Reads one variable. Used for TEST_DATABASE_URL, which the app never needs. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is not set. Copy .env.example to .env.`);
  }
  return value;
}
