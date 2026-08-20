import { GoogleGenAI } from "@google/genai";
import { REPORT_MODEL } from "./model";
import { parseReportResponse } from "./parse";
import { buildPrompt, loadPromptTemplate, type TranscriptTurn } from "./prompt";

export interface GeneratedReport {
  readonly content: string;
  /** The model that produced this text, stored alongside the report. */
  readonly model: string;
}

/**
 * The boundary. Everything above this depends on this interface rather than on
 * @google/genai, so replacing the implementation — with Genkit once there is
 * more than one AI feature, or with a stub in tests — is contained to this
 * file.
 */
export interface ReportGenerator {
  generate(turns: ReadonlyArray<TranscriptTurn>): Promise<GeneratedReport>;
}

export interface GeminiReportGeneratorOptions {
  readonly apiKey: string;
  readonly model?: string;
  /** Injectable for tests; defaults to the prompt.md beside this file. */
  readonly template?: string;
}

/**
 * The Gemini API (generativelanguage.googleapis.com), authenticated with an
 * API key.
 *
 * This was originally built against Vertex AI in express mode. That route is
 * closed on a consumer Google account: express-mode keys are bound to a
 * service account and pinned to the Gemini API by the Google-managed policy
 * `iam.managed.disableServiceAccountApiKeyCreation`, which cannot be edited on
 * a project with no organization parent. See ADR 0008.
 *
 * No `vertexai` flag, no project, no location. Nothing here reads application
 * default credentials or shells out to gcloud — if the key is rejected, the
 * error propagates rather than falling back to another auth method.
 */
export function createGeminiReportGenerator(
  options: GeminiReportGeneratorOptions,
): ReportGenerator {
  if (options.apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY is empty.");
  }

  const model = options.model ?? REPORT_MODEL;
  const template = options.template ?? loadPromptTemplate();
  const client = new GoogleGenAI({ apiKey: options.apiKey });

  return {
    async generate(turns) {
      const response = await client.models.generateContent({
        model,
        contents: buildPrompt(template, turns),
      });
      return { content: parseReportResponse(response), model };
    },
  };
}
