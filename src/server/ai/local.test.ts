import { describe, expect, it, vi } from "vitest";
import { createLocalReportGenerator } from "./local";
import type { TranscriptTurn } from "./prompt";

const turns: ReadonlyArray<TranscriptTurn> = [
  {
    position: 1,
    questionText: "Tell me about a complex project.",
    answerText: "I led a distributed database migration.",
  },
];

const validReportPayload = {
  turns: [
    {
      position: 1,
      situation: {
        score: 3,
        evidence: "Described distributed database context.",
      },
      task: { score: 3, evidence: "Goal was migrating live data." },
      action: { score: 4, evidence: "Executed dual-write phase." },
      result: { score: 4, evidence: "Zero downtime achieved." },
      learning: { score: 3, evidence: "Learned monitoring nuances." },
      strength: "Strong ownership and technical clarity.",
      improvement: "Could quantify dataset size.",
    },
  ],
  headline: "Solid engineering leadership.",
  narrative:
    "You communicated technical details clearly and demonstrated ownership.",
};

describe("createLocalReportGenerator", () => {
  it("calls Ollama /api/chat with format json by default", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify(validReportPayload),
        },
      }),
    });

    const generator = createLocalReportGenerator({
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const report = await generator.generate(turns);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"model":"llama3.2"'),
      }),
    );
    expect(report.model).toBe("llama3.2");
    expect(report.content).toBe(validReportPayload.narrative);
    expect(report.structured?.turns).toHaveLength(1);
  });

  it("calls /v1/chat/completions when baseUrl ends with /v1", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(validReportPayload),
            },
          },
        ],
      }),
    });

    const generator = createLocalReportGenerator({
      baseUrl: "http://localhost:1234/v1",
      model: "qwen2.5:7b",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const report = await generator.generate(turns);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:1234/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"model":"qwen2.5:7b"'),
      }),
    );
    expect(report.model).toBe("qwen2.5:7b");
    expect(report.structured?.turns).toHaveLength(1);
  });

  it("provides helpful error when server is unreachable", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValue(new Error("fetch failed (ECONNREFUSED)"));

    const generator = createLocalReportGenerator({
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(generator.generate(turns)).rejects.toThrow(
      /Local AI server is unreachable at http:\/\/localhost:11434/,
    );
  });
});
