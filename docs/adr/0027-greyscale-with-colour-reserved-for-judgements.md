# 27. Greyscale, with colour reserved for judgements

Supersedes the colour clause of
[21](0021-the-avatar-is-two-colours.md) and
[22](0022-the-user-declares-their-turn.md).

Amended 2026-08-23: colour is admitted to a fourth place, construction, and the
button half of the rule now lives in a `tone` variant rather than in prose.

## Decision

Every structural part of the interface is zero chroma: surfaces, rules,
controls, text, the avatar, status marks. Colour appears in exactly four
places, and all four are a judgement on an answer or a consequence of an
action:

- **Scores.** A pillar or overall score of 1 is red, 2 amber, 3 ink, 4 green.
- **Destruction.** The confirm button of a destructive dialog, and the hover
  state of the control that opens it.
- **Construction.** The hover state of a control that creates something. Only
  the question bank's Add button qualifies today.
- **Failure and absence.** Error text, and the amber notice for a session whose
  report was never written.

Destruction and construction are the same clause read in both directions: a
control that is about to change what exists says so in the hue of the change,
and says nothing until it is hovered or focused. Both are a tint — `/10` fill,
coloured text — because the solid fill belongs to the confirm button of the
dialog, which is the point of no return. "End interview" was solid red on
hover and is now a tint, which brings the last trigger into line with that.

The rule is carried by a `tone` variant on `Button` — `tone="destructive"`,
`tone="success"` — rather than by four hand-written class strings, which had
already drifted into three different treatments of the same meaning. `Notice`
took the same prop name first; a control and a message now name their colour
the same way.

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
good", or naming what an action is about to make or destroy, it is grey.

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
- The rule is only enforced where a button carries it. A `tone` variant stops
  the next control from inventing its own red, but nothing stops the next
  `bg-success` from being written onto something that is not a button and not
  a judgement.
- Admitting a fourth place makes the list easier to add a fifth to. The list is
  the budget; it is worth spending an argument before extending it.
