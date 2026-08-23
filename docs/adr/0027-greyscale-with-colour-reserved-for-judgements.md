# 27. Greyscale, with colour reserved for judgements

Supersedes the colour clause of
[21](0021-the-avatar-is-two-colours.md) and
[22](0022-the-user-declares-their-turn.md).

## Decision

Every structural part of the interface is zero chroma: surfaces, rules,
controls, text, the avatar, status marks. Colour appears in exactly three
places, and all three are judgements or consequences:

- **Scores.** A pillar or overall score of 1 is red, 2 amber, 3 ink, 4 green.
- **Destruction.** The confirm button of a destructive dialog, and the hover
  state of the control that opens it.
- **Failure and absence.** Error text, and the amber notice for a session whose
  report was never written.

The four neutrals the app is built from — `--paper`, `--sheet`, `--sunk`,
`--wash` — and the three inks and two rules above them are the single source of
truth. shadcn's token names are mapped onto that ramp rather than defined
alongside it.

Two things lost their colour to this:

- The avatar was green while the microphone was open. It is now solid ink when
  open and an outline on paper when shut.
- "Report ready" in the session list was green. It is now a filled mark and
  darker text, against a hollow mark and lighter text for "No report".

The semantic hues also dropped in chroma — `--destructive` from `0.2` to
`0.16`, `--success` and `--warning` from `0.13`/`0.12` to `0.09`. All four
still pass AA as small text on `--sheet`.

## Why

The palette was already neutral apart from three tokens, but the three leaked.
A green avatar 160px across sat in the middle of the calmest screen in the app,
saying what the microphone icon inside it already said. A green pip appeared on
nearly every row of a list whose whole job is to be skimmed. Five tinted score
chips per answer put fifteen coloured pills on a three-answer report.

None of those were judgements. They were states, and states are what value,
weight and shape are for. Spending colour on them meant that by the time the
report reached something colour genuinely had to say — this answer scored 1 —
the page had no contrast left to say it with.

The rule that falls out is easy to hold: if a mark is not saying "this was
good" or "this will destroy something", it is grey.

## Pros

- The scored parts of the report are the only coloured things in the app, so
  they are found without being hunted for.
- One neutral ramp, named for the job each step does, so two screens asking for
  the same surface get the same surface.
- Removing colour forced the states it was carrying onto icon, fill and weight,
  which are the things that survive a greyscale print, a cheap monitor and the
  eight percent of men who would not have seen the green anyway.

## Cons

- The avatar no longer distinguishes "microphone open" from "microphone shut"
  by hue, so it rests entirely on the icon and the fill inverting.
- A 3 is ink, which on a greyscale page looks like an unstyled number rather
  than a deliberate midpoint. It is deliberate; nothing on screen says so.
- The rule needs enforcing by hand. Nothing stops the next `bg-success` from
  being added to something that is not a judgement.
