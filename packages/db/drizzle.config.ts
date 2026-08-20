import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// The single .env lives at the repo root, not beside this package.
config({ path: "../../.env" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url },
});
