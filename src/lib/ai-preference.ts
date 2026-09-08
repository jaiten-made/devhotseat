import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { AIProvider } from "@/server/env";
import {
  isProvider,
  MODEL_KEY,
  type ModelChoices,
  PROVIDER_KEY,
  parseModelChoices,
  resolveEffectiveModel,
} from "./ai-model-choice";
import { aiStatusQuery } from "./queries";

const PREFERENCE_EVENT = "devhotseat_ai_preference_change";

function readProvider(): AIProvider | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(PROVIDER_KEY);
  return isProvider(saved) ? saved : null;
}

function readModels(): ModelChoices {
  if (typeof window === "undefined") return {};
  return parseModelChoices(localStorage.getItem(MODEL_KEY));
}

/**
 * The provider and model the next report should be written with, and the
 * status the picker renders. Both halves of the choice are the browser's, so
 * they travel with each request rather than being held on the server.
 */
export function useAiPreference() {
  const statusQuery = useQuery(aiStatusQuery());

  const [provider, setStoredProvider] = useState<AIProvider | null>(
    readProvider,
  );
  const [models, setStoredModels] = useState<ModelChoices>(readModels);

  useEffect(() => {
    // Both the in-tab event and the cross-tab `storage` event re-read from
    // localStorage, so a second window showing the picker stays in step.
    const sync = () => {
      setStoredProvider(readProvider());
      setStoredModels(readModels());
    };

    window.addEventListener(PREFERENCE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PREFERENCE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setProvider = useCallback((next: AIProvider) => {
    localStorage.setItem(PROVIDER_KEY, next);
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  }, []);

  const setModel = useCallback((target: AIProvider, model: string) => {
    const next = { ...readModels(), [target]: model };
    localStorage.setItem(MODEL_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  }, []);

  const status = statusQuery.data;
  const effectiveProvider: AIProvider =
    provider ?? status?.activeProvider ?? "local";
  const activeStatus =
    effectiveProvider === "gemini" ? status?.gemini : status?.local;

  return {
    effectiveProvider,
    /** The model this provider will actually be asked for. */
    effectiveModel: resolveEffectiveModel(
      models[effectiveProvider],
      activeStatus,
    ),
    /** What the user picked, per provider — absent means "use the default". */
    pickedModels: models,
    setProvider,
    setModel,
    status,
    isLoading: statusQuery.isPending,
    isError: statusQuery.isError,
    refetchStatus: () => statusQuery.refetch(),
  };
}
