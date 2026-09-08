import { createServerFn } from "@tanstack/react-start";
import { listGeminiModels, listLocalModels } from "../server/ai/models";
import { resolveAiProvider } from "../server/deps";
import { type AIProvider, loadEnv } from "../server/env";

/** What one provider can currently do, as the picker needs to render it. */
export interface ProviderStatus {
  /** Whether the provider answered at all — Ollama running, key accepted. */
  readonly isReachable: boolean;
  /** Every model it will run right now. Empty when unreachable. */
  readonly availableModels: ReadonlyArray<string>;
  /** The configured model, used when the user has not picked one. */
  readonly defaultModel: string;
  readonly error?: string;
}

export interface AiStatus {
  readonly activeProvider: AIProvider;
  readonly hasGeminiKey: boolean;
  readonly local: ProviderStatus & { readonly baseUrl: string };
  readonly gemini: ProviderStatus;
}

/**
 * The Gemini catalogue barely moves, and the picker polls this status while
 * its dialog is open. Cached briefly so opening the dialog does not spend an
 * API call per render. The local list is not cached: pulling a model is
 * exactly the moment a user reopens the picker expecting to see it.
 */
const GEMINI_CACHE_MS = 5 * 60 * 1000;
let geminiCache:
  | {
      at: number;
      key: string;
      listing: Awaited<ReturnType<typeof listGeminiModels>>;
    }
  | undefined;

async function geminiModels(apiKey: string) {
  const now = Date.now();
  if (
    geminiCache &&
    geminiCache.key === apiKey &&
    now - geminiCache.at < GEMINI_CACHE_MS
  ) {
    return geminiCache.listing;
  }
  const listing = await listGeminiModels(apiKey);
  // A failed listing is not cached, so a key fixed in .env or a network that
  // came back is picked up on the next refresh rather than five minutes later.
  if (listing.reachable) {
    geminiCache = { at: now, key: apiKey, listing };
  }
  return listing;
}

/**
 * Which providers are usable and what each one can run. Probed on every call
 * rather than at boot, because Ollama is routinely started after the app.
 */
export const fetchAiStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<AiStatus> => {
    const env = loadEnv();
    const hasGeminiKey = env.GEMINI_API_KEY.trim() !== "";

    const [local, gemini] = await Promise.all([
      listLocalModels(env.LOCAL_AI_BASE_URL),
      hasGeminiKey
        ? geminiModels(env.GEMINI_API_KEY)
        : Promise.resolve({
            reachable: false,
            models: [] as ReadonlyArray<string>,
            error: "GEMINI_API_KEY is not set.",
          }),
    ]);

    return {
      activeProvider: resolveAiProvider(),
      hasGeminiKey,
      local: {
        baseUrl: env.LOCAL_AI_BASE_URL,
        isReachable: local.reachable,
        availableModels: local.models,
        defaultModel: env.LOCAL_AI_MODEL,
        error: local.error,
      },
      gemini: {
        isReachable: gemini.reachable,
        availableModels: gemini.models,
        defaultModel: env.GEMINI_MODEL,
        error: gemini.error,
      },
    };
  },
);
