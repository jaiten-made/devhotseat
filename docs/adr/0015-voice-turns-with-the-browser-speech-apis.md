# 15. Voice turns using the browser's own speech APIs

## Decision

A turn is spoken: the question is read aloud with `speechSynthesis`, then the
microphone opens via the Web Speech API and the answer is transcribed. Both are
browser built-ins, so no dependency was added.

Questions still come from the bank, fixed and independent. Nothing calls Gemini
during the turn loop; the report is still the only AI call.

Sequencing lives in a second pure machine, `src/lib/voice/machine.ts`, separate
from the session machine. That one owns what is persisted; this one owns what is
happening in the browser and is never stored.

Typing remains available at all times, and is what the e2e specs drive.

## Why

devprep used Google Cloud TTS, which needs a new dependency and a service
account — an auth model this project deliberately does not have. The browser's
voice is worse but free, offline, and already present.

## Pros

- No new dependencies, no credentials, no per-turn cost.
- The voice loop is testable without a browser.

## Cons

- Speech recognition is Chrome-family only; other browsers get typing.
- Voice quality depends on the machine's installed voices.
