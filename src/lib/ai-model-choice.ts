import type { ProviderStatus } from "../fn/ai";
import type { AIProvider } from "../server/env";

/**
 * Where the picker's choices live. The provider key predates model selection
 * and is left alone, so an existing install keeps the provider it was on and
 * simply gains a model choice.
 */
export const PROVIDER_KEY = "devhotseat_ai_provider";
export const MODEL_KEY = "devhotseat_ai_models";

/** The model picked per provider, so switching back and forth is not lossy. */
export type ModelChoices = Partial<Record<AIProvider, string>>;

export function isProvider(value: unknown): value is AIProvider {
  return value === "local" || value === "gemini";
}

/**
 * Parses the stored model choices. Hand-edited or half-written storage yields
 * an empty set rather than an exception: this runs during the first render of
 * every page, and there is nothing here worth failing a boot over.
 */
export function parseModelChoices(raw: string | null): ModelChoices {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const record = parsed as Record<string, unknown>;
    const choices: ModelChoices = {};
    for (const provider of ["local", "gemini"] as const) {
      const value = record[provider];
      if (typeof value === "string" && value !== "") choices[provider] = value;
    }
    return choices;
  } catch {
    return {};
  }
}

/**
 * The model a request should carry: what the user picked, unless the provider
 * no longer offers it.
 *
 * Dropping a stale pick matters because the list is live. Deleting an Ollama
 * tag would otherwise leave the app quietly asking for a model that is gone,
 * and that surfaces as a provider error mid-session instead of as a picker
 * that has moved on. An empty list means the provider is unreachable and has
 * told us nothing, which is not evidence against the pick.
 */
export function resolveEffectiveModel(
  picked: string | undefined,
  status: ProviderStatus | undefined,
): string {
  const fallback = status?.defaultModel ?? "";
  if (!picked) return fallback;
  const available = status?.availableModels ?? [];
  if (available.length > 0 && !available.includes(picked)) return fallback;
  return picked;
}
