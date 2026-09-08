import { describe, expect, it, vi } from "vitest";
import {
  isReportCapableModel,
  isWellFormedModelId,
  listLocalModels,
  normaliseBaseUrl,
  resolveModelId,
} from "./models";

describe("isWellFormedModelId", () => {
  it("accepts the shapes both providers actually publish", () => {
    for (const id of [
      "llama3.2",
      "qwen2.5:7b-instruct",
      "gemini-3.5-flash-lite",
      "hf.co/bartowski/model-GGUF:Q4_K_M",
    ]) {
      expect(isWellFormedModelId(id), id).toBe(true);
    }
  });

  it("rejects ids that would redirect the provider request", () => {
    for (const id of [
      "",
      "  ",
      "../../secrets",
      "models/../tunedModels/x",
      "https://evil.example/v1",
      "model?key=leak",
      "model with spaces",
      "/leading-slash",
      "a".repeat(129),
    ]) {
      expect(isWellFormedModelId(id), id).toBe(false);
    }
  });
});

describe("resolveModelId", () => {
  it("keeps a well-formed request", () => {
    expect(resolveModelId("qwen2.5:7b", "llama3.2")).toBe("qwen2.5:7b");
  });

  it("trims before deciding", () => {
    expect(resolveModelId("  llama3.2  ", "fallback")).toBe("llama3.2");
  });

  it("falls back rather than passing a malformed id to the provider", () => {
    expect(resolveModelId("../../etc/passwd", "llama3.2")).toBe("llama3.2");
    expect(resolveModelId(undefined, "llama3.2")).toBe("llama3.2");
    expect(resolveModelId("", "llama3.2")).toBe("llama3.2");
  });
});

describe("normaliseBaseUrl", () => {
  it("drops trailing slashes so paths do not double up", () => {
    expect(normaliseBaseUrl("http://localhost:11434//")).toBe(
      "http://localhost:11434",
    );
  });
});

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

describe("listLocalModels", () => {
  it("reads Ollama tags from a bare host", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        models: [{ name: "llama3.2" }, { name: "qwen2.5:7b" }],
      }),
    );

    const listing = await listLocalModels(
      "http://localhost:11434",
      fetchFn as unknown as typeof fetch,
    );

    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:11434/api/tags",
      expect.anything(),
    );
    expect(listing).toMatchObject({
      reachable: true,
      models: ["llama3.2", "qwen2.5:7b"],
    });
  });

  it("reads the OpenAI-compatible list when the base URL ends in /v1", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: [{ id: "local-model" }] }));

    const listing = await listLocalModels(
      "http://localhost:1234/v1",
      fetchFn as unknown as typeof fetch,
    );

    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:1234/v1/models",
      expect.anything(),
    );
    expect(listing.models).toEqual(["local-model"]);
  });

  it("falls back to /v1/models when the native tags endpoint 404s", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      })
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "served-model" }] }));

    const listing = await listLocalModels(
      "http://localhost:8000",
      fetchFn as unknown as typeof fetch,
    );

    expect(listing).toMatchObject({
      reachable: true,
      models: ["served-model"],
    });
  });

  it("reports an unreachable runner instead of throwing", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("fetch failed"));

    const listing = await listLocalModels(
      "http://localhost:11434",
      fetchFn as unknown as typeof fetch,
    );

    expect(listing.reachable).toBe(false);
    expect(listing.models).toEqual([]);
    expect(listing.error).toBe("fetch failed");
  });

  it("treats a running runner with nothing pulled as reachable and empty", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ models: [] }));

    const listing = await listLocalModels(
      "http://localhost:11434",
      fetchFn as unknown as typeof fetch,
    );

    expect(listing).toMatchObject({ reachable: true, models: [] });
  });
});

describe("isReportCapableModel", () => {
  it("offers the text models that write reports", () => {
    for (const id of [
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.1-pro-preview",
      "gemini-2.5-pro",
    ]) {
      expect(isReportCapableModel(id, ["generateContent"]), id).toBe(true);
    }
  });

  it("hides the families that would accept the prompt and return junk", () => {
    for (const id of [
      "text-embedding-004",
      "gemini-embedding-001",
      "imagen-4.0-generate-001",
      "veo-3.0-generate-001",
      "gemini-2.5-flash-preview-tts",
      "gemini-3-pro-image",
      "gemini-2.5-computer-use-preview-10-2025",
      "aqa",
    ]) {
      expect(isReportCapableModel(id, ["generateContent"]), id).toBe(false);
    }
  });

  it("hides a model that does not do generateContent at all", () => {
    expect(isReportCapableModel("some-model", ["embedContent"])).toBe(false);
  });

  it("keeps a model that reports no actions, rather than guessing against it", () => {
    expect(isReportCapableModel("gemini-4-flash", [])).toBe(true);
  });
});
