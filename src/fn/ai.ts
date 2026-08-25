import { createServerFn } from "@tanstack/react-start";
import { resolveAiProvider } from "../server/deps";
import { loadEnv } from "../server/env";

export interface AiStatus {
  activeProvider: "local" | "gemini";
  hasGeminiKey: boolean;
  geminiModel: string;
  localAi: {
    baseUrl: string;
    model: string;
    isReachable: boolean;
    availableModels: string[];
    error?: string;
  };
}

export const fetchAiStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<AiStatus> => {
    const env = loadEnv();
    const hasGeminiKey = env.GEMINI_API_KEY.trim() !== "";
    const activeProvider = resolveAiProvider();
    const cleanBaseUrl = env.LOCAL_AI_BASE_URL.replace(/\/+$/, "");

    let isReachable = false;
    let availableModels: string[] = [];
    let errorMessage: string | undefined;

    try {
      if (cleanBaseUrl.endsWith("/v1")) {
        // OpenAI-compatible models endpoint
        const res = await fetch(`${cleanBaseUrl}/models`, {
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          isReachable = true;
          const data = (await res.json()) as {
            data?: Array<{ id: string }>;
          };
          availableModels = (data.data ?? []).map((m) => m.id);
        } else {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
      } else {
        // Ollama tags endpoint
        const res = await fetch(`${cleanBaseUrl}/api/tags`, {
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          isReachable = true;
          const data = (await res.json()) as {
            models?: Array<{ name: string }>;
          };
          availableModels = (data.models ?? []).map((m) => m.name);
        } else {
          // Fallback to /v1/models if Ollama was configured with /v1
          const v1Res = await fetch(`${cleanBaseUrl}/v1/models`, {
            signal: AbortSignal.timeout(1500),
          }).catch(() => null);
          if (v1Res?.ok) {
            isReachable = true;
            const data = (await v1Res.json()) as {
              data?: Array<{ id: string }>;
            };
            availableModels = (data.data ?? []).map((m) => m.id);
          } else {
            errorMessage = `HTTP ${res.status}: ${res.statusText}`;
          }
        }
      }
    } catch (err: unknown) {
      isReachable = false;
      errorMessage =
        err instanceof Error ? err.message : "Connection timed out or refused";
    }

    return {
      activeProvider,
      hasGeminiKey,
      geminiModel: env.GEMINI_MODEL,
      localAi: {
        baseUrl: env.LOCAL_AI_BASE_URL,
        model: env.LOCAL_AI_MODEL,
        isReachable,
        availableModels,
        error: errorMessage,
      },
    };
  },
);
