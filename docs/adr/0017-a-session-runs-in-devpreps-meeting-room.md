# 17. A session runs in devprep's meeting room

## Decision

An in-progress session is a full-viewport call screen, not a page in the app
shell: header, avatar stage, a transcript panel down the right, and a turn
control (ADR 19). The parts are ports of devprep's meeting room, in
`src/components/interview`.

The avatar is three concentric circles. The outer halo expands only while the
question is being read, so "it is talking" reads from across the room; the
middle ring pulses in every live state; the core carries the colour. Which look
belongs to which voice state is a pure function in `src/lib/voice/machine.ts`,
unit-tested rather than checked by eye.

Typing shares the room: same header, same avatar, a textarea for the answer.

## Why

Practising an interview should feel like sitting in one. A form on a page does
not.

## Pros

- Both input modes are one screen, so switching does not relocate you.
- The avatar reports what the app is doing without being read.

## Cons

- `fixed inset-0` covers the app nav instead of restructuring the routes into
  a layout.
- devprep's END control becomes "Leave": nothing ends a session early, so it
  stays in progress.
