# 11. End-to-end tests stub report generation

## Decision

Playwright drives the real stack: a real Vite server, real server functions,
real Postgres. Two things are swapped by environment variable in the
`webServer` config:

- `HOTSEAT_STUB_REPORTS=1` returns a fixed report instead of calling Gemini.
  Since ADR 0025 that includes a full STAR-L rubric over whatever turns were
  sent, with scores cycling by turn so the radar draws a lopsided shape rather
  than a regular pentagon — a chart that looked the same however it was wired
  would not be worth asserting on.
- `DATABASE_URL` points at the test database, never the dev one.

## Why

The alternative — hitting Gemini for real — was weighed and rejected. It would
prove the key and the whole pipe, but it adds seconds per run, spends tokens,
fails offline, and produces nondeterministic prose, so assertions could only
check that something non-empty rendered. It also cannot test the case that
matters most here: a session whose report failed to generate.

The real path is not left unverified. Milestone 3 made one real call that
returned real text, and milestone 10 is a run by hand.

## Pros

- A full run takes seconds, costs nothing, and works offline.
- The missing-report state is testable on purpose rather than by accident.

## Cons

- e2e never exercises the real generator, so a Gemini regression shows up
  only in manual use.
- One environment branch exists in application code purely for tests.
