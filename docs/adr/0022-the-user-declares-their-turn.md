# 22. The user declares their turn

Supersedes [0021](0021-the-avatar-is-two-colours.md).

## Decision

The microphone opens on a press, never when the voice reports being finished.
The press is accepted while the question is still being read, and silences it —
interrupting, as it works with a person.

So there is no turn indicator. The avatar reports whether the microphone is
open, from the same boolean that opens it.

The first press is what starts the interview. Entering the room reads nothing
out; the voice loop begins in a `waiting` state that refuses the ask, and only
the press moves it on. Later turns follow on by themselves — nothing returns
to `waiting`.

## Why

`speechSynthesis` exposes no audio object, so when the voice actually stopped
is unknowable. `end` is the engine's claim and can arrive early. A hand-over
derived from it eventually records the app talking, and transcribes the
question into the answer Gemini marks.

Owning the audio would fix that. A local model measured 88 MB and 1.35× slower
than realtime in the browser — longer to prepare a question than to say it.
Rejected on latency.

A press cannot be wrong about itself.

Reading on arrival was worse than merely startling. A session is a URL, so the
room is entered by reload, by back, and by a tab restored on browser start —
none of which mean anyone is sitting ready to answer. Autoplay policy makes
the same point from the other side: speech wants a gesture behind it, and the
press is one.

## Pros

- The colour and the microphone are one fact, so they cannot disagree.
- Interrupting is a feature rather than a hazard.
- Nothing is spoken into a room nobody is in.

## Cons

- One press more per turn than correct guessing needs.
- Press late and the question is still being read under your first words.
