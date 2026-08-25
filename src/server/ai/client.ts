import { GoogleGenAI } from "@google/genai";
import type { StructuredReport } from "../../lib/report/schema";
import { REPORT_MODEL } from "./model";
import { parseReportResponse } from "./parse";
import { buildPrompt, loadPromptTemplate, type TranscriptTurn } from "./prompt";
import { REPORT_JSON_SCHEMA } from "./response-schema";

export {
  createLocalReportGenerator,
  type LocalReportGeneratorOptions,
} from "./local";

export interface GeneratedReport {
  readonly content: string;
  /** The scored rubric, or null when only the prose came back usable. */
  readonly structured: StructuredReport | null;
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
        config: {
          // Required whenever a schema is set.
          responseMimeType: "application/json",
          responseJsonSchema: REPORT_JSON_SCHEMA,
          // Scoring the same transcript twice should not swing a band.
          temperature: 0.3,
          // A five-turn report runs to roughly 1200 tokens; this is headroom.
          // Running out truncates the JSON, which costs the whole report.
          maxOutputTokens: 4096,
        },
      });
      return {
        ...parseReportResponse(
          response,
          turns.map((turn) => turn.position),
        ),
        model,
      };
    },
  };
}
