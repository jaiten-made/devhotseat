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
    // Chrome drops the next utterance if cancel() is called when the queue is
    // already empty, so only cancel when there is something to stop.
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
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

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 1;
      utteranceRef.current = utterance;

      utterance.onend = finish;
      utterance.onerror = finish;

      window.speechSynthesis.speak(utterance);

      // Completion comes from the real end event, never from a timer
      // estimating how long the sentence takes.
      //
      // This watchdog only catches synthesis that never engaged at all — a
      // machine with no installed voices accepts speak() and silently does
      // nothing, firing neither end nor error, which would strand the turn.
      // It deliberately does not pre-check getVoices(): that returns an empty
      // array until voices load asynchronously, so checking it up front skips
      // speech entirely on the first question. Queued speech sets `pending`
      // straight away, so a real utterance never trips this.
      window.setTimeout(() => {
        if (
          !window.speechSynthesis.speaking &&
          !window.speechSynthesis.pending
        ) {
          finish();
        }
      }, 600);
    },
    [cancel],
  );

  // Leaving the page mid-sentence should not keep the browser talking.
  useEffect(() => cancel, [cancel]);

  return { speak, cancel };
}
