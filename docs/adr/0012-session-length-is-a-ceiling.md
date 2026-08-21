# 12. Session length is a ceiling, not a quota

> **Superseded by [0014](0014-a-session-is-the-whole-question-bank.md).**
> A session now asks every question in the bank; there is no ceiling.

## Decision

A session needs one question in the bank, not `SESSION_LENGTH` of them. The
machine starts a session of `min(SESSION_LENGTH, availableQuestions)` and
refuses only an empty bank, with the reason `empty_question_bank`.

## Why

Requiring a full bank made the tool unusable until five questions existed,
which is the worst moment to add friction. A bank of one should give a session
of one.

Repeating questions to pad a short session was rejected: being asked the same
thing twice in one sitting is worse practice than a shorter sitting, and
questions are already drawn without replacement.

## Pros

- The tool is useful from the first question added.
- `sessions.question_count` was already snapshotted per session, so
  variable-length sessions needed no schema change and old sessions still
  render their own length correctly.

## Cons

- Session length depends on when the session started, so comparing across
  sessions has to account for it.
- `SESSION_LENGTH` describes only a maximum, a weaker guarantee to reason
  about.
