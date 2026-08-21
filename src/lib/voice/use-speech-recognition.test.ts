// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSpeechRecognition } from "./use-speech-recognition";

/**
 * A stand-in for the browser's recogniser, which jsdom does not have.
 *
 * It records what was asked of it rather than doing anything, and every
 * instance built is kept so a test can tell a replacement recogniser from the
 * original — the difference between the microphone being shut and the hook
 * quietly opening a second one.
 */
class FakeRecognition extends EventTarget implements SpeechRecognition {
  static instances: FakeRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;

  started = false;
  stopped = false;

  constructor() {
    super();
    FakeRecognition.instances.push(this);
  }

  start(): void {
    this.started = true;
  }

  /** The real engine fires `end` after a stop; the test does that by hand. */
  stop(): void {
    this.stopped = true;
  }

  abort(): void {
    this.stopped = true;
  }
}

const live = () => FakeRecognition.instances.at(-1);

beforeEach(() => {
  FakeRecognition.instances = [];
  window.SpeechRecognition = FakeRecognition;
});

afterEach(() => {
  cleanup();
  delete window.SpeechRecognition;
});

describe("useSpeechRecognition", () => {
  it("opens the microphone on start", () => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());

    expect(FakeRecognition.instances).toHaveLength(1);
    expect(live()?.started).toBe(true);
    expect(result.current.isListening).toBe(true);
  });

  // The regression this file exists for: leaving the room mid-answer used to
  // leave the recogniser running, because nothing stopped it on the way out.
  it("shuts the microphone when the component goes away", () => {
    const { result, unmount } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());
    const recognition = live();

    unmount();

    expect(recognition?.stopped).toBe(true);
  });

  // A stopped recogniser still reports `end`, and that is what restarts it
  // after a pause. Arriving late, it must not build a replacement: nothing
  // would hold a handle to it, so the microphone could never be shut again.
  it("does not restart itself after the component goes away", () => {
    const { result, unmount } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());
    const recognition = live();

    unmount();
    act(() => recognition?.onend?.());

    expect(FakeRecognition.instances).toHaveLength(1);
  });

  // The pause-and-continue behaviour the deliberate stop above is measured
  // against: an `end` while still mounted is the engine giving up on silence,
  // and the hook is expected to pick the microphone back up.
  it("restarts itself when the engine ends on its own", () => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());

    act(() => live()?.onend?.());

    expect(FakeRecognition.instances).toHaveLength(2);
    expect(live()?.started).toBe(true);
  });
});
