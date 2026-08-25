import { config } from "dotenv";
import { z } from "zod";

// Loads .env from the working directory, which is the repo root for both
// `pnpm dev` and the test runners.
config();

export type AIProvider = "local" | "gemini";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  GEMINI_API_KEY: z.string().optional().default(""),
  AI_PROVIDER: z.enum(["local", "gemini"]).optional(),
  LOCAL_AI_BASE_URL: z.string().optional().default("http://localhost:11434"),
  LOCAL_AI_MODEL: z.string().optional().default("llama3.2"),
  GEMINI_MODEL: z.string().optional().default("gemini-3.5-flash-lite"),
});

export type EnvConfig = z.infer<typeof schema>;

/**
 * Validated environment. Throws with the names of the missing variables rather
 * than letting `undefined` reach the database driver or the AI client and fail
 * as something more confusing later.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): EnvConfig {
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
