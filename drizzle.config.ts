import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// The .env sits at the repo root, which is also the cwd: this was left
// pointing two directories up by the collapse to a single package (ADR 9).
config();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url },
});
