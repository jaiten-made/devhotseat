# 32. A session is the questions picked for it

Supersedes [0014](0014-a-session-is-the-whole-question-bank.md).

## Decision

A session asks the questions chosen for it when it is created, shuffled into a
random order, each exactly once. Sessions are created from **Sessions** — a
`New session` screen that lists the bank with a checkbox on every row, ticked
by default — and the question bank goes back to being only a bank: add, delete,
and a link through to the picker.

The machine takes the number of questions picked and makes it the session
length, refusing only a pick of none. `createSession` resolves the ids against
the bank inside its transaction, so duplicates collapse and an id deleted since
the picker was drawn is simply not asked.

## Why

Requested. Starting a session from the bank made the two the same thing, which
is fine at five questions and wrong at forty: there was no way to sit a short
practice run against a large bank, and no way to practise one weak question
without deleting the rest. Picking is also where the choice belongs — the bank
is the library, a session is a sitting.

## Pros

- A short run against a large bank, which
  [0014](0014-a-session-is-the-whole-question-bank.md) explicitly gave up.
- Practise one question, or the three that went badly last time, without
  touching the bank.
- Sessions are created from the screen they are listed on, so the whole
  lifecycle of a session lives under **Sessions**.
- `sessions.question_count` was already snapshotted, so no schema change and
  finished sessions still render their own length.

## Cons

- One more step between wanting to practise and practising. The picker opens
  with everything ticked, so the old behaviour is the default and the extra
  step is a single button press.
- Two screens now read the bank, and the picker has to tolerate it changing
  underneath: what is ticked is stored as ids and resolved against the bank on
  the way out, twice — once in the browser, once in the transaction.
- `no_questions_selected` replaces `empty_question_bank`. An empty bank is now
  just the smallest case of nothing being picked, so the picker says so itself
  rather than the machine naming it.
