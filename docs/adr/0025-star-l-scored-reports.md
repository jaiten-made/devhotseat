# 25. Reports are scored against STAR-L, stored as jsonb beside the prose

## Decision

A finished session is scored on five pillars — Situation, Task, Action,
Result, Learning — 1 to 4 each, for every answered turn. The weights are
12 / 8 / 55 / 17 / 8 and live in `src/lib/report/rubric.ts`, which the prompt
renders and the score maths divides by.

The model returns JSON, constrained by `responseJsonSchema` derived from the
same zod schema that validates the reply. The rubric is stored in a new
nullable `reports.structured` jsonb column; `reports.content` stays, demoted
from a ~400-word report to the ~180-word coaching narrative. The report page is
hand-rolled SVG and CSS on the existing tokens.

This reverses the v1 decision in `docs/spec.md` that feedback would be prose
only, with no rubric and no per-answer scoring.

## Why

Prose alone could not answer "was that answer any good, and which one was
worst". A practice tool whose feedback cannot be compared between answers gives
you nothing to aim at.

Scoring per answer rather than per session is what makes the weighting mean
something: the weighting is *within* an answer, so a story with no execution in
it scores badly however well it was framed. The session roll-up is the plain
mean of the per-turn scores, so every question counts equally.

jsonb beside the prose rather than a `report_scores` table: there is one report
per session, it is read whole, and nothing queries it by score. A normalised
table would mean four joins to rebuild a document we always want in full.
Nullable, because a report written before this existed has no rubric, and a
model that returns usable prose but unusable JSON should still leave one.

Hand-rolled SVG rather than a chart dependency: it is five points on a
pentagon. The geometry lives in `src/lib/report/radar.ts` and is unit tested,
which a charting library would not have been.

## Pros

- The rubric is one constants module, so the prompt and the maths cannot drift.
- Old reports keep rendering: no backfill, no breaking change, one metadata-only
  `ALTER TABLE`.
- Degradation is layered — scored report, else prose, else no report. All three
  already had a meaning in the UI.
- No new runtime dependency and no bundle-size cost.

## Cons

- `parseReportResponse` now has three failure modes to reason about instead of
  one, and the response can fail validation in ways plain text never could.
- The scores are only as good as a lite model's judgement. `REPORT_MODEL` is one
  line if that stops being good enough.
- Scoring all five pillars on a question that never invited a full story
  produces an honestly low Result. Keeping the question bank behavioural is now
  part of using the tool properly.
- Two documented Gemini keywords had to be dropped by hand (see below).

## The API constraints found by testing against it

`minItems`/`maxItems` are documented as supported on `responseJsonSchema` and
are not: with them on `turns`, an array of objects, `gemini-3.5-flash-lite`
rejects the request with a bare `400 INVALID_ARGUMENT`. They are stripped in
`src/server/ai/response-schema.ts`; the bounds still apply locally because the
zod schema keeps them. `thinkingConfig: { thinkingBudget: 0 }` is also rejected
by this model, so it is not set.

Both were found by bisecting against the live API, and both are guarded by a
unit test that walks the generated schema.
