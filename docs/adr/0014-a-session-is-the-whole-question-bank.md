# 14. A session is the whole question bank

Supersedes [0012](0012-session-length-is-a-ceiling.md).

## Decision

A session asks every question in the bank, shuffled into a random order, each
exactly once. There is no `SESSION_LENGTH` constant and no cap. The machine
takes the bank size and makes it the session length, refusing only an empty
bank.

## Why

Requested. A cap meant the bank and the session were different things, which
needed explaining in the UI. Now the bank *is* the session: add questions you
want to practise, run them, add more.

## Pros

- One less concept, one less constant, one less line of copy.
- `sessions.question_count` was already snapshotted, so no schema change and
  finished sessions still render their own length.
- Random ordering keeps repeat practice from getting stale.

## Cons

- No short practice run against a large bank. A 40-question bank means a
  40-question sitting, and there is no early exit.
- Session length is now driven by an unbounded number, so a large bank makes
  the report prompt correspondingly large.
