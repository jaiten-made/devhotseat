# 23. The room opens on a briefing

Extends [0022](0022-the-user-declares-their-turn.md).

## Decision

While the spoken loop is `waiting`, the stage is a lobby, not a question: a
heading, the number of questions, the three turn-taking steps, and a note that
the microphone is about to be asked for. The header drops the progress line for
"Not started".

The first question appears when it is spoken, and not before. Typing is
unaffected — it shows the question straight away, because reading it is the mode.

## Why

Waiting for a press left the room holding a question nobody had asked. It read
as a page with a sentence on it, and the sentence was the one thing the session
was meant to spring on you: a tab opened before lunch gives you half an hour to
prepare an answer that is supposed to be cold.

The avatar made it worse. It reports the microphone, so before the start it is
grey with a struck-through mic — the shape of a fault, at the one moment the
screen is meant to be inviting. Leaving it out of the lobby says the same thing
without the alarm.

The steps carry the turn bar's own icons, so the control at the bottom is
already legible the first time it changes.

## Pros

- The question is heard, not read ahead of time.
- What the press is about to do is stated before it is pressed.
- Nothing in the lobby looks broken.

## Cons

- One more state the room renders differently.
- The briefing is shown every session, long after it is news.
