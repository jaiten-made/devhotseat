import { GoogleGenAI } from "@google/genai";

/**
 * What a provider can currently run, discovered at request time rather than
 * hard-coded, so a newly pulled Ollama tag or a newly released Gemini model
 * shows up in the picker without a code change.
 *
 * Server-only: listing Gemini models needs the API key, which must not reach
 * the browser bundle.
 */
export interface ModelListing {
  readonly reachable: boolean;
  readonly models: ReadonlyArray<string>;
  readonly error?: string;
}

/** Long enough for any real tag, short enough not to be a payload. */
const MAX_MODEL_ID_LENGTH = 128;

/**
 * The characters a model id can legitimately contain: Ollama tags
 * (`qwen2.5:7b-instruct`, `hf.co/user/repo:Q4_K_M`) and Gemini ids
 * (`gemini-3.5-flash-lite`) both fit.
 *
 * This is a boundary check, not a spell-check. A Gemini id is interpolated
 * into the request path, so an id carrying `..` or a scheme could aim the call
 * somewhere other than the model endpoint. Anything failing this is discarded
 * for the configured default instead of being sent.
 */
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*(:[A-Za-z0-9._-]+)?$/;

export function isWellFormedModelId(value: string): boolean {
  if (value.length === 0 || value.length > MAX_MODEL_ID_LENGTH) return false;
  if (value.includes("..")) return false;
  return MODEL_ID_PATTERN.test(value);
}

/**
 * The model a request should actually run, given what the client asked for.
 *
 * The requested id arrives from the browser, so it is never trusted as a path
 * fragment. It is not checked against the live list, though: doing that would
 * put a model-listing round trip in front of every report, and a stale pick
 * fails loudly at the provider anyway.
 */
export function resolveModelId(
  requested: string | undefined,
  fallback: string,
): string {
  const trimmed = requested?.trim() ?? "";
  if (trimmed === "" || !isWellFormedModelId(trimmed)) return fallback;
  return trimmed;
}

/** Strip the trailing slashes an operator's copy-pasted base URL tends to keep. */
export function normaliseBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

interface OpenAiModelsResponse {
  readonly data?: ReadonlyArray<{ id?: string }>;
}

interface OllamaTagsResponse {
  readonly models?: ReadonlyArray<{ name?: string }>;
}

function describeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Connection timed out or refused";
}

async function readOpenAiModels(
  url: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<ReadonlyArray<string> | null> {
  const response = await fetchFn(url, {
    signal: AbortSignal.timeout(timeoutMs),
  }).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json()) as OpenAiModelsResponse;
  return (body.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === "string" && id !== "");
}

/**
 * Which models the local runner has pulled, and whether it is running at all.
 *
 * An unreachable runner is an ordinary answer here rather than a thrown error:
 * "Ollama is not started" is the single most likely state on a fresh checkout,
 * and the picker needs to render it, not crash on it.
 */
export async function listLocalModels(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<ModelListing> {
  const url = normaliseBaseUrl(baseUrl);

  try {
    // An operator who pointed LOCAL_AI_BASE_URL at LM Studio or vLLM has
    // already said which dialect they speak; only the bare host is ambiguous.
    if (url.endsWith("/v1")) {
      const models = await readOpenAiModels(`${url}/models`, fetchFn, 2500);
      if (models === null) {
        return {
          reachable: false,
          models: [],
          error: `No response from ${url}`,
        };
      }
      return { reachable: true, models };
    }

    const response = await fetchFn(`${url}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    if (response.ok) {
      const body = (await response.json()) as OllamaTagsResponse;
      return {
        reachable: true,
        models: (body.models ?? [])
          .map((entry) => entry.name)
          .filter(
            (name): name is string => typeof name === "string" && name !== "",
          ),
      };
    }

    // Something is listening but it is not Ollama's native API. Try the
    // OpenAI-compatible surface before calling the runner unreachable.
    const models = await readOpenAiModels(`${url}/v1/models`, fetchFn, 1500);
    if (models !== null) return { reachable: true, models };

    return {
      reachable: false,
      models: [],
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error: unknown) {
    return { reachable: false, models: [], error: describeError(error) };
  }
}

/**
 * Model families the Gemini API lists that cannot write a report: embeddings,
 * image and video generation, speech, and computer use.
 *
 * Matched on the id rather than on `supportedActions`, because the API
 * advertises `generateContent` for most of these anyway — an image model will
 * happily accept the prompt and return something that is not a report.
 *
 * Substrings, not exact ids, so a model released after this was written is
 * filtered on the same naming convention rather than needing an upgrade.
 */
const NON_TEXT_MODEL_MARKERS = [
  "embedding",
  "aqa",
  "imagen",
  "veo",
  "-tts",
  "-image",
  "computer-use",
  "learnlm",
];

/** Whether a listed Gemini model is one this app should offer for scoring. */
export function isReportCapableModel(
  name: string,
  supportedActions: ReadonlyArray<string> = [],
): boolean {
  if (
    supportedActions.length > 0 &&
    !supportedActions.includes("generateContent")
  ) {
    return false;
  }
  return !NON_TEXT_MODEL_MARKERS.some((marker) => name.includes(marker));
}

/**
 * The Gemini models this key can reach, listed live so a model released after
 * this app was built is selectable without an upgrade.
 *
 * Returns unreachable rather than throwing on a rejected or absent key — the
 * status endpoint reports that state, and the picker disables the option.
 */
export async function listGeminiModels(apiKey: string): Promise<ModelListing> {
  if (apiKey.trim() === "") {
    return {
      reachable: false,
      models: [],
      error: "GEMINI_API_KEY is not set.",
    };
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const pager = await client.models.list({ config: { queryBase: true } });

    const models: string[] = [];
    for await (const model of pager) {
      // The API returns `models/gemini-3.5-flash-lite`; generateContent takes
      // the bare id, and that is what gets stored on the report.
      const id = (model.name ?? "").replace(/^models\//, "");
      if (id !== "" && isReportCapableModel(id, model.supportedActions ?? [])) {
        models.push(id);
      }
    }

    return { reachable: true, models: models.sort() };
  } catch (error: unknown) {
    return { reachable: false, models: [], error: describeError(error) };
  }
}
