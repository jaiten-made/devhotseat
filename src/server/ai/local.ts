import type { GeneratedReport, ReportGenerator } from "./client";
import { parseReportResponse } from "./parse";
import { buildPrompt, loadPromptTemplate, type TranscriptTurn } from "./prompt";

export const DEFAULT_LOCAL_AI_BASE_URL = "http://localhost:11434";
export const DEFAULT_LOCAL_AI_MODEL = "llama3.2";

export interface LocalReportGeneratorOptions {
  readonly baseUrl?: string;
  readonly model?: string;
  /** Injectable for tests; defaults to the prompt.md beside this file. */
  readonly template?: string;
  /** Custom fetch function, useful for tests. */
  readonly fetchFn?: typeof fetch;
}

function buildLocalSchemaInstruction(
  turns: ReadonlyArray<TranscriptTurn>,
): string {
  const count = turns.length;
  const positions = turns.map((t) => t.position).join(", ");
  return `
Output your entire response as a single valid JSON object.
CRITICAL: The "turns" array must contain EXACTLY ${count} item(s) corresponding to position(s) [${positions}]. Do NOT invent or add extra turns.

Structure:
{
  "turns": [
    {
      "position": ${turns[0]?.position ?? 1},
      "situation": { "score": 1, "evidence": "sentence quoting candidate" },
      "task": { "score": 1, "evidence": "sentence quoting candidate" },
      "action": { "score": 1, "evidence": "sentence quoting candidate" },
      "result": { "score": 1, "evidence": "sentence quoting candidate" },
      "learning": { "score": 1, "evidence": "sentence quoting candidate" },
      "strength": "single strongest point",
      "improvement": "single change to improve"
    }
  ],
  "headline": "Under 15 words summary",
  "narrative": "Coaching note addressed to 'you' under 180 words"
}
Do not include any Markdown or explanations outside the JSON.`;
}

/**
 * A ReportGenerator that connects to a local LLM server such as Ollama or
 * any OpenAI-compatible local endpoint (LM Studio, LocalAI, llama-server).
 */
export function createLocalReportGenerator(
  options: LocalReportGeneratorOptions = {},
): ReportGenerator {
  const baseUrl = (options.baseUrl ?? DEFAULT_LOCAL_AI_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const model = options.model ?? DEFAULT_LOCAL_AI_MODEL;
  const template = options.template ?? loadPromptTemplate();
  const customFetch = options.fetchFn ?? fetch;

  return {
    async generate(
      turns: ReadonlyArray<TranscriptTurn>,
    ): Promise<GeneratedReport> {
      const promptText = `${buildPrompt(template, turns)}\n\n${buildLocalSchemaInstruction(turns)}`;
      const isOpenAiEndpoint = baseUrl.endsWith("/v1");

      try {
        let responseText = "";

        if (isOpenAiEndpoint) {
          // Standard OpenAI-compatible format (e.g. LM Studio, vLLM, Ollama /v1)
          const response = await customFetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "system",
                  content:
                    "You are a senior engineering hiring manager scoring a practice interview. You MUST respond with valid JSON matching the requested schema.",
                },
                {
                  role: "user",
                  content: promptText,
                },
              ],
              response_format: { type: "json_object" },
              temperature: 0.3,
            }),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => "");
            throw new Error(
              `Local AI server returned HTTP ${response.status}: ${errText || response.statusText}`,
            );
          }

          const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          responseText = data.choices?.[0]?.message?.content ?? "";
        } else {
          // Native Ollama endpoint (/api/chat)
          const response = await customFetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "system",
                  content:
                    "You are a senior engineering hiring manager scoring a practice interview. You MUST respond with valid JSON matching the requested schema.",
                },
                {
                  role: "user",
                  content: promptText,
                },
              ],
              format: "json",
              stream: false,
              options: {
                temperature: 0.3,
              },
            }),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => "");
            throw new Error(
              `Local AI server returned HTTP ${response.status}: ${errText || response.statusText}`,
            );
          }

          const data = (await response.json()) as {
            message?: { content?: string };
          };
          responseText = data.message?.content ?? "";
        }

        return {
          ...parseReportResponse(
            { text: responseText },
            turns.map((turn) => turn.position),
          ),
          model,
        };
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          (error.message.includes("fetch failed") ||
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("Failed to fetch"))
        ) {
          throw new Error(
            `Local AI server is unreachable at ${baseUrl}. Ensure Ollama or your local model server is running (e.g. 'ollama run ${model}') or toggle to Gemini API.`,
          );
        }
        throw error;
      }
    },
  };
}
