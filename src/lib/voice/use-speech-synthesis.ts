import { useCallback, useEffect, useRef } from "react";

/**
 * Reads text aloud with the browser's built-in voice.
 *
 * `onDone` fires on the real `end` event, never a timer, and also fires if
 * synthesis errors: a question that cannot be spoken must still let the turn
 * continue rather than stranding the session.
 */
export function useSpeechSynthesis() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = utteranceRef.current;
    if (utterance) {
      utterance.onend = null;
      utterance.onerror = null;
      utteranceRef.current = null;
    }
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    (text: string, onDone: () => void) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        onDone();
        return;
      }
      cancel();

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        utteranceRef.current = null;
        onDone();
      };

      // A machine with no installed voices accepts speak() and does nothing:
      // no end event, no error event. Without this the turn would wait on a
      // signal that never comes.
      if (window.speechSynthesis.getVoices().length === 0) {
        finish();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 1;
      utteranceRef.current = utterance;

      utterance.onend = finish;
      utterance.onerror = finish;

      window.speechSynthesis.speak(utterance);

      // Completion still comes from the real end event, never from a timer
      // estimating how long the sentence takes. This only catches the case
      // where synthesis never engaged at all, which is otherwise silent.
      window.setTimeout(() => {
        if (
          !window.speechSynthesis.speaking &&
          !window.speechSynthesis.pending
        ) {
          finish();
        }
      }, 250);
    },
    [cancel],
  );

  // Leaving the page mid-sentence should not keep the browser talking.
  useEffect(() => cancel, [cancel]);

  return { speak, cancel };
}
