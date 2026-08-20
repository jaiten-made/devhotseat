# 2. Three-layer test split

> **Amended by [0009](0009-single-package-on-tanstack-start.md):**
> the integration layer now tests services directly, not HTTP endpoints.

## Decision

Three layers, no overlap, with fixed script names:

- `test:unit` — Vitest, colocated `*.test.ts`. Pure functions only: machine
  transitions, prompt construction, response parsing. No DB, no network.
- `test:integration` — Vitest, `*.integration.test.ts`. Exercises the service
  layer against a real Postgres test database. The report generator is stubbed
  at its client boundary.
- `test:e2e` — Playwright, driving the browser against the local stack.

The root only fans out with `pnpm -r --if-present`; it holds no test logic.
A package defines a script only when it has tests of that kind.

## Why

Each layer answers a question the others cannot. Unit tests pin down logic
that is expensive to reach through HTTP. Integration tests prove route wiring
and status codes, which mocking a service layer hides. Playwright proves the
UI is connected, and nothing more.

## Pros

- A failure names its own layer, so the cause is usually obvious.
- The slow layers stay thin because the fast layers already cover the logic.

## Cons

- `--if-present` means a typo in a script name silently skips a package rather
  than erroring.
- Three configs to keep aligned.
