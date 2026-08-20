# 5. A hand-rolled session state machine, not XState

## Decision

The session machine is a pure `transition(state, event)` function over
discriminated unions, returning `{ ok: true, state }` or
`{ ok: false, reason }`. No state-machine library.

The server holds no machine instance between requests: state is rebuilt from
the database on each call via `stateFromSession`. `generating_report` is
transient and never persisted, so the database only stores `in_progress` or
`completed`.

## Why

The HTTP layer needs a *reason* when it refuses an event, so answering an ended
session is a 409 and starting one with an empty bank is a 422. XState silently
ignores unhandled events, so rejections would need a guard layer to recover
what a reducer returns directly. This is ~90 lines.

devprep's XState v5 machine informed the shape — named states, union events,
transitions in one place, no timers — but not its client-side hosting.

## Pros

- Rejection reasons map straight onto status codes.
- Totality is provable: a 20-case state-by-event matrix covers every pairing.

## Cons

- No visualiser or statechart export.
- Nested behaviour later (pause, resume, retry with backoff) would degrade a
  hand-rolled switch faster than it would XState.
