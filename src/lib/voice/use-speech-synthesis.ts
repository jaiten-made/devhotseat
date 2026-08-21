import { useCallback, useEffect, useRef } from "react";

/**
 * Voice names preferred in descending order, matched loosely.
 *
 * Chrome ships its own voices and, at least on Linux, does not surface the
 * system ones from speech-dispatcher at all — so espeak and mbrola never
 * appear in the list even when installed. Chrome's own voices are better than
 * either, so they are what this prefers.
 */
const PREFERRED_VOICES = ["google us english", "google uk english", "google"];

function preferredVoice(
  voices: ReadonlyArray<SpeechSynthesisVoice>,
): SpeechSynthesisVoice | null {
  const english = voices.filter((voice) => voice.lang.startsWith("en"));
  if (english.length === 0) return null;

  for (const wanted of PREFERRED_VOICES) {
    const match = english.find((voice) =>
      voice.name.toLowerCase().includes(wanted),
    );
    if (match) return match;
  }
  // Nothing preferred is present; let the browser keep its own default.
  return null;
}

/**
 * Reads text aloud with the browser's built-in voice.
 *
 * `onDone` fires on the real `end` event, never a timer, and also fires if
 * synthesis errors: a question that cannot be spoken must still let the turn
 * continue rather than stranding the session.
 *
 * `onWord` fires as the engine passes each word, which is the only progress
 * signal synthesis gives out. There is no audio stream behind
 * `speechSynthesis` — it renders straight to the output device and exposes no
 * node to attach an analyser to — so word boundaries are as close to the
 * spoken audio as anything can get without paying for hosted speech. Not
 * every voice reports them, so callers must still work when it never fires.
 */
export function useSpeechSynthesis() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = utteranceRef.current;
    if (utterance) {
      utterance.onend = null;
      utterance.onerror = null;
      utterance.onboundary = null;
      utteranceRef.current = null;
    }
    // Chrome drops the next utterance if cancel() is called when the queue is
    // already empty, so only cancel when there is something to stop.
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback(
    (text: string, onDone: () => void, onWord?: () => void) => {
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
      const preferred = preferredVoice(window.speechSynthesis.getVoices());
      if (preferred) utterance.voice = preferred;
      utteranceRef.current = utterance;

      utterance.onend = finish;
      utterance.onerror = finish;
      if (onWord) {
        utterance.onboundary = (event) => {
          // Engines that distinguish the two also report sentence boundaries,
          // which would throb once per question rather than once per word.
          if (event.name && event.name !== "word") return;
          onWord();
        };
      }

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
