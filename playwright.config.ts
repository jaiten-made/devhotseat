import { defineConfig } from "@playwright/test";
import { config } from "dotenv";

config();

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not set. Copy .env.example to .env.");
}

export default defineConfig({
  testDir: "./e2e",
  // One database, seeded per spec: specs must not overlap.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // The real stack, pointed at the test database rather than the dev one,
      // with report generation stubbed so a run is deterministic and free.
      DATABASE_URL: testDatabaseUrl,
      HOTSEAT_STUB_REPORTS: "1",
    },
  },
});
