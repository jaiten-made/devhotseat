import { describe, expect, it, vi } from "vitest";
import { createLocalReportGenerator } from "./local";
import type { TranscriptTurn } from "./prompt";
import { REPORT_JSON_SCHEMA } from "./response-schema";

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
  it("calls Ollama /api/chat with the report schema by default", async () => {
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
    // `format: "json"` only buys "some JSON object", and a small local model
    // periodically returns a flattened rubric that the parser can only degrade
    // to prose. The schema constrains decoding to the shape instead.
    const [, init] = mockFetch.mock.calls[0] as [string, { body: string }];
    const sent = JSON.parse(init.body) as {
      format?: Record<string, unknown>;
    };
    expect(sent.format).toEqual(REPORT_JSON_SCHEMA);

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
