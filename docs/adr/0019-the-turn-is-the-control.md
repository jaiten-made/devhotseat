# 19. The turn is the control

## Decision

The bottom of the session room is one wide bar naming whose turn it is, with
the incidentals as small ghost buttons beneath it. Hanging up moves to the
header.

The bar renders as a `button` only while the move is the user's *and* there is
an answer to hand over; in every other state it is a `div role="status"
aria-live="polite"`. So pressability is the interface: if it looks pressable,
pressing it advances the conversation. This replaces ADR 17's round controls,
and the permanently disabled microphone light whose job the avatar's colour
already did.

## Why

Six identical circles could not say which one moved the conversation on:
"Submit" looked like a peer of "Transcript". A strictly turn-for-turn
conversation should look like one.

## Pros

- One filled control on screen, so there is never a question of what to press.
- The status role announces each hand-over to a screen reader for free.
- Empty answers are unpressable rather than silently discarded.

## Cons

- Playwright matches the bar by its visible text, so copy changes break specs.
- Loudness swells only the avatar: `--mic-level` lands on one element.
