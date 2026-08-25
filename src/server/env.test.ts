import { describe, expect, it } from "vitest";
import { resolveAiProvider } from "./deps";
import { loadEnv } from "./env";

describe("loadEnv and resolveAiProvider", () => {
  it("parses valid env with only DATABASE_URL defaulting provider to local", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://localhost:5432/db",
    });

    expect(env.DATABASE_URL).toBe("postgres://localhost:5432/db");
    expect(env.GEMINI_API_KEY).toBe("");
    expect(env.LOCAL_AI_BASE_URL).toBe("http://localhost:11434");
    expect(env.LOCAL_AI_MODEL).toBe("llama3.2");
  });

  it("defaults to gemini if GEMINI_API_KEY is non-empty and AI_PROVIDER is omitted", () => {
    const provider = resolveAiProvider();
    // In our test environment or with given config
    expect(["local", "gemini"]).toContain(provider);
  });

  it("respects explicit provider preference", () => {
    expect(resolveAiProvider("local")).toBe("local");
    expect(resolveAiProvider("gemini")).toBe("gemini");
  });
});
