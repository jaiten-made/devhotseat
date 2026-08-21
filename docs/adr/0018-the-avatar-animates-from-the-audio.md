# 18. The avatar animates from the audio, not a clock

> **Superseded by [21](0021-the-avatar-is-two-colours.md).**

## Decision

While the question is read, the halo throbs once per word, driven by
`SpeechSynthesisUtterance.onboundary`. While listening, a second microphone
stream feeds an `AnalyserNode`, and the root mean square of each frame drives a
`--mic-level` custom property that swells the rings.

The level is written straight to the DOM rather than held in React state: it
changes every animation frame, and sixty re-renders a second for a decoration
is not worth it. The response curve is a pure function, `micLevel`, so it is
unit-tested.

Both paths degrade. A voice that reports no word boundaries keeps the steady
ping; a refused microphone keeps the opacity pulse.

## Why

The fixed CSS animation was legible, but plainly was not listening to anything.

## Pros

- The avatar reports the actual voice, so a stalled engine now looks stalled.
- No dependency, no credential, no per-question cost.

## Cons

- `speechSynthesis` exposes no audio node, so the app's own voice can only be
  followed per word. True amplitude needs hosted speech, which
  [15](0015-voice-turns-with-the-browser-speech-apis.md) rejected.
- A second microphone consumer runs alongside recognition.
- Word boundaries are unreliable on Chrome's network voices.
