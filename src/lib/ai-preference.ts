import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { AIProvider } from "@/server/env";
import { aiStatusQuery } from "./queries";

const STORAGE_KEY = "devhotseat_ai_provider";
const PREFERENCE_EVENT = "devhotseat_ai_provider_change";

export function useAiPreference() {
  const statusQuery = useQuery(aiStatusQuery());

  const [storedPreference, setStoredPreference] = useState<AIProvider | null>(
    () => {
      if (typeof window === "undefined") return null;
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "local" || saved === "gemini" ? saved : null;
    },
  );

  useEffect(() => {
    const handleStorage = (event: Event) => {
      const customEvent = event as CustomEvent<AIProvider>;
      if (customEvent.detail) {
        setStoredPreference(customEvent.detail);
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        setStoredPreference(
          saved === "local" || saved === "gemini" ? saved : null,
        );
      }
    };

    window.addEventListener(PREFERENCE_EVENT, handleStorage);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(PREFERENCE_EVENT, handleStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setPreference = useCallback((newPref: AIProvider) => {
    localStorage.setItem(STORAGE_KEY, newPref);
    setStoredPreference(newPref);
    window.dispatchEvent(
      new CustomEvent(PREFERENCE_EVENT, { detail: newPref }),
    );
  }, []);

  const serverDefault = statusQuery.data?.activeProvider ?? "local";
  const effectiveProvider: AIProvider = storedPreference ?? serverDefault;

  return {
    effectiveProvider,
    storedPreference,
    setPreference,
    status: statusQuery.data,
    isLoading: statusQuery.isPending,
    isError: statusQuery.isError,
    refetchStatus: () => statusQuery.refetch(),
  };
}
