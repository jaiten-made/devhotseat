import { useSyncExternalStore } from "react";

function speechRecognitionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

function speechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

const subscribe = () => () => {};

/**
 * Whether this browser can run the voice loop. Read through
 * useSyncExternalStore so the server render and the first client render agree:
 * on the server nothing is supported, and the value settles after hydration.
 */
export function useSpeechSupport(): {
  canListen: boolean;
  canSpeak: boolean;
  supported: boolean;
} {
  const canListen = useSyncExternalStore(
    subscribe,
    speechRecognitionAvailable,
    () => false,
  );
  const canSpeak = useSyncExternalStore(
    subscribe,
    speechSynthesisAvailable,
    () => false,
  );
  return { canListen, canSpeak, supported: canListen && canSpeak };
}
