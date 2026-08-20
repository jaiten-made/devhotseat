import { join } from "node:path";
import { config } from "dotenv";
import { z } from "zod";

// One .env at the repo root, three directories up from this file.
config({ path: join(import.meta.dirname, "..", "..", "..", ".env") });

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
});

/**
 * Validated environment. Reading this throws at boot with the names of the
 * missing variables, rather than letting `undefined` reach the Vertex client
 * and fail as a confusing auth error later.
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
