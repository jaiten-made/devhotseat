# 28. One layout vocabulary, and two typefaces that divide language from data

## Decision

Every screen is built from one small set of primitives in
`src/components/ui/page.tsx`: `Page`, `PageHeader`, `Section`, `Panel`,
`RowList`/`Row`, `EmptyState`, `Notice` and `Marker`. Routes compose those
rather than choosing their own margins.

`PageHeader` takes an eyebrow, a title and a description, and the eyebrow is
always the screen's key datum — how many questions are in the bank, how many
sessions there are, when this session ran, which question you are on. The
interview room keeps its full-viewport layout ([17](0017-a-session-runs-in-devpreps-meeting-room.md))
but its header is the same eyebrow-over-title, so the one screen with no
navigation still reads as part of the app.

Loading, error and empty branches render the header too. They used to return a
bare paragraph.

Two self-hosted typefaces, and which one a thing is set in carries meaning:

- **Outfit** for language — questions, answers, coaching prose, titles.
- **IBM Plex Mono** for data — scores, weights, positions, timestamps, status
  marks, and the tracked-out `.field-label` that names every block.

`Marker` prints a position as `03 / 07`, and only sequences get one. A
session's turns are a sequence and are numbered. The question bank is a set,
asked in a random order every session, so its rows are not.

## Why

Each route had invented its own rhythm. The bank led with a title and a
description at one margin, the session list with a title and nothing at
another, the transcript with a title and a date at a third — so moving between
them nudged the content up and down the page. The loading branches dropped the
heading entirely, which meant every screen visibly rebuilt itself the moment
its query landed.

The typeface split does a job colour used to do. With
[27](0027-greyscale-with-colour-reserved-for-judgements.md) taking hue away
from everything structural, something else had to separate a score from a
sentence. Setting one in mono and the other in the text face states it once, at
every size, without a legend.

## Pros

- A new screen is a header and some sections; there is nothing to decide.
- `03 / 07` in the transcript and `Question 3 of 7` in the room are visibly the
  same fact, because they are set in the same face.
- The numbering rule is falsifiable: if the bank ever gains a fixed order, its
  rows earn markers, and if it does not, they never do.

## Cons

- Two font families are two more things to load, even self-hosted. IBM Plex
  Mono ships as static weights, so 400, 500 and 600 are three files per subset.
- The primitives are blunt on purpose, and a screen that genuinely needs
  something outside the set has to either bend one or grow the set.
- `PageHeader` requires an eyebrow. A screen with no interesting datum has to
  invent one, which is why the loading states say things like "Loading".
