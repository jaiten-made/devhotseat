import { type RefObject, useEffect, useRef } from "react";

/**
 * Speech sits low in the 0..1 range that root mean square reports, so it is
 * amplified before use. Raw readings would barely move the avatar.
 */
const GAIN = 8;

/** How much of the previous reading each frame keeps, to stop the jitter. */
const SMOOTHING = 0.75;

/**
 * One frame of the microphone level, smoothed against the last one. Pure, so
 * the response curve is unit-tested rather than judged by watching it wobble.
 */
export function micLevel(rms: number, previous: number): number {
  const scaled = Math.min(1, Math.max(0, rms) * GAIN);
  return previous * SMOOTHING + scaled * (1 - SMOOTHING);
}

/**
 * Drives a `--mic-level` custom property, 0 to 1, from how loudly the
 * microphone is hearing right now. Returns the ref to put on the element that
 * should carry it.
 *
 * The value is written straight to the DOM rather than returned as state:
 * it changes every animation frame, and React cannot re-render the room sixty
 * times a second for a decoration.
 *
 * This is a second consumer of the microphone, alongside the speech
 * recognition that is already running, so permission has been granted by the
 * time it opens. A refusal is swallowed on purpose — a missing animation must
 * never interrupt a turn.
 */
export function useMicLevel(active: boolean): RefObject<HTMLDivElement | null> {
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!active || !target) return;

    let cancelled = false;
    let frame = 0;
    let context: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let level = 0;

    const release = () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      for (const track of stream?.getTracks() ?? []) track.stop();
      void context?.close();
      target.style.setProperty("--mic-level", "0");
    };

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((granted) => {
        if (cancelled) {
          for (const track of granted.getTracks()) track.stop();
          return;
        }
        stream = granted;
        context = new AudioContext();
        // A context can start suspended, which would leave the analyser dark.
        void context.resume();

        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(granted).connect(analyser);

        const samples = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) sum += sample * sample;
          // Root mean square is loudness as heard, rather than the loudest
          // single sample, so one click does not throw the avatar wide open.
          level = micLevel(Math.sqrt(sum / samples.length), level);
          target.style.setProperty("--mic-level", level.toFixed(3));
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        // No second stream for us; the avatar keeps its steady pulse.
      });

    return release;
  }, [active]);

  return targetRef;
}
