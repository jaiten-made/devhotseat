import { useCallback, useRef, useState } from "react";

/** Consecutive no-speech events tolerated before giving up. */
const MAX_NO_SPEECH_RETRIES = 20;

export interface UseSpeechRecognitionReturn {
  start: () => void;
  stop: () => void;
  /** Snapshot read from refs, so a click reads the latest text, not React's. */
  getTranscript: () => string;
  /**
   * The words the engine has committed, for display only. `getTranscript` is
   * still what gets submitted; this exists so the UI can show committed and
   * in-flight words differently without printing the interim text twice.
   */
  finalTranscript: string;
  interimTranscript: string;
  isListening: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Continuous speech recognition over the Web Speech API.
 *
 * The engine stops on its own after a pause, so `onend` restarts it unless we
 * stopped deliberately. Final results accumulate in a ref rather than state:
 * devprep learned that reading React state at click time loses the last few
 * words the engine had only just committed.
 */
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const accumulatedRef = useRef("");
  const interimRef = useRef("");
  const stoppedDeliberatelyRef = useRef(false);
  const noSpeechRetriesRef = useRef(0);

  const getTranscript = useCallback(
    () => `${accumulatedRef.current} ${interimRef.current}`.trim(),
    [],
  );

  const stop = useCallback(() => {
    stoppedDeliberatelyRef.current = true;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    accumulatedRef.current = "";
    interimRef.current = "";
    noSpeechRetriesRef.current = 0;
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    const Impl = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Impl) {
      setError("unsupported");
      return;
    }
    if (recognitionRef.current) return;

    stoppedDeliberatelyRef.current = false;
    setError(null);
    setIsListening(true);

    const build = (): SpeechRecognition => {
      const recognition = new Impl();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result?.[0]?.transcript ?? "";
          if (result?.isFinal) {
            accumulatedRef.current =
              `${accumulatedRef.current} ${text.trim()}`.trim();
            setFinalTranscript(accumulatedRef.current);
            noSpeechRetriesRef.current = 0;
          } else {
            interim += text;
          }
        }
        interimRef.current = interim;
        setInterimTranscript(interim);
      };

      recognition.onerror = (event) => {
        if (event.error === "no-speech") {
          noSpeechRetriesRef.current += 1;
          if (noSpeechRetriesRef.current < MAX_NO_SPEECH_RETRIES) return;
        }
        setError(event.error);
        if (event.error === "not-allowed" || event.error === "audio-capture") {
          stoppedDeliberatelyRef.current = true;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // Only the instance still being tracked may restart itself.
        //
        // `stoppedDeliberatelyRef` alone is not enough: it is one flag for the
        // whole hook, and `end` can arrive long after the instance it belongs
        // to was stopped — the recognition service is hosted, so the round
        // trip is a network one. If the flag has since been cleared by a new
        // turn calling `start`, a late `end` would build a second recogniser
        // and overwrite the ref with it. Nothing then holds a handle to the
        // first, so `stop` can never reach it and it keeps the microphone open
        // straight through the next question being read aloud.
        if (recognitionRef.current !== recognition) return;

        // The engine ends itself after a pause; keep going unless we meant it.
        if (stoppedDeliberatelyRef.current) {
          setIsListening(false);
          return;
        }
        const next = build();
        recognitionRef.current = next;
        try {
          next.start();
        } catch {
          // The ref is cleared so a later `start` can build a fresh one. Left
          // set, it would look like a live recogniser and every later `start`
          // would return early against a microphone that is actually shut.
          recognitionRef.current = null;
          setIsListening(false);
        }
      };

      return recognition;
    };

    const recognition = build();
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Already started; the existing instance is fine.
    }
  }, []);

  return {
    start,
    stop,
    getTranscript,
    finalTranscript,
    interimTranscript,
    isListening,
    error,
    reset,
  };
}
