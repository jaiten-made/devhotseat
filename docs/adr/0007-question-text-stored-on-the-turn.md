# 7. Turns store question text, not a question reference

## Decision

`turns.question_text` holds the question exactly as it was asked, copied from
the bank when the session starts. There is no foreign key from `turns` to
`questions` at all — not even a nullable one.

## Why

A transcript records what actually happened, but the bank is mutable. If a turn
pointed at a bank row, deleting that question would blank the turn, break the
read, or force an `ON DELETE SET NULL` leaving the transcript half-empty.
Copying the text makes it self-contained by construction.

A nullable `question_id` was considered and dropped: it enables only
cross-session question analytics, an explicit non-goal.

## Pros

- Old transcripts cannot be corrupted by editing the bank. Verified: deleting
  the source question leaves the turn text unchanged.
- Reading a transcript is one join fewer.

## Cons

- The same question text is duplicated once per session that asks it.
- Linking a turn back to its bank entry later would need a backfill, and text
  matching would be the only way to reconstruct it.
