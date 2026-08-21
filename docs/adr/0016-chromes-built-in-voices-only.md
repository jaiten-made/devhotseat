# 16. Chrome's built-in voices, and nothing else

## Decision

The app uses whatever voices the browser already provides, preferring Chrome's
own English voices. No system speech packages are installed or documented as
part of setup.

## Why

Setup simplicity. Chrome ships usable voices, so the app speaks with nothing
installed at all.

Installing more was tried and added nothing: `espeak-ng` and five `mbrola`
packages went on, and Chrome never listed one of them. It does not surface
speech-dispatcher voices here, so 21 MB sat unused. Both were removed.

Recognition is unaffected by any of this — it is a hosted service, not a local
engine, so voice packages were never going to change it.

## Pros

- Nothing to install, so nothing to document or keep working.
- The voices Chrome bundles are better than the system ones anyway.

## Cons

- Tied to Chrome. Brave and similar builds ship without the recognition
  service and fail with a `network` error; the app falls back to typing.
- No control over voice quality. Genuinely natural speech would mean a
  realtime conversational model rather than more local voice packages, which
  is a different feature, not a bigger install.
