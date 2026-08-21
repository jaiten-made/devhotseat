# 21. The avatar is two colours

> **Superseded by [22](0022-the-user-declares-their-turn.md).**

Supersedes [0018](0018-the-avatar-animates-from-the-audio.md).

## Decision

The avatar says whose turn it is by colour and nothing else: black while the
interviewer talks, green while it is the user's turn, grey when it is neither.
No throb, no ping, no swell.

Word boundaries and the second microphone stream are gone, and with them
`useMicLevel`, `micLevel` and `--mic-level`. `speak` reports completion, not
progress.

`orbStateFor` takes the voice state alone. A recognition fault leaves the
avatar green — it is still the user's turn — with the error text beneath it. A
blocked microphone leaves it inert behind the overlay that already explains
itself.

## Why

Three animation drivers for two colours. Both signals are unreliable on
Chrome's network voices, as 18 itself noted, so the avatar read poorly while
being the most complicated thing on screen.

## Pros

- One pure function over five states, covered in both directions: the colour
  and the microphone are the same fact.
- No second microphone consumer, no `AudioContext`, no per-frame DOM writes.

## Cons

- A stalled voice no longer looks stalled.
- Waiting on the server looks like waiting on the turn. The bar says which.
