# 16. Chrome's built-in voices, and nothing else

## Decision

The app speaks with whatever voices the browser already provides, preferring
Chrome's own English ones. No system speech packages, and no hosted
text-to-speech service.

## Why

**Free.** Browser synthesis costs nothing per question. Google Cloud TTS bills
per character, so every question read aloud would meter against an account, on
top of a second credential to manage — for a tool practising the same questions
repeatedly. The report is already a paid call; the voice does not need to be.

**Simple.** Chrome ships usable voices, so the app speaks with nothing
installed.

Installing more was tried and added nothing: `espeak-ng` and five `mbrola`
packages went on, Chrome never listed one of them, and both were removed.

## Pros

- No per-use cost and no second credential.
- Nothing to install, so nothing to document or keep working.

## Cons

- Tied to Chrome. Brave and similar builds withhold the hosted recognition
  service and fail with `network`; the app falls back to typing.
- No control over voice quality. Genuinely natural speech means a realtime
  conversational model, not more local voice packages.
