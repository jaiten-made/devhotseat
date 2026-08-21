# 24. Leaving the room ends the interview

Amends [0017](0017-a-session-runs-in-devpreps-meeting-room.md), whose cost was
"nothing ends a session early, so it stays in progress".

## Decision

The room has one exit and it ends the interview. Pressing it writes the report
from the answers actually given, stamps `ended_at` and leaves you on the
finished session. No answers means no report, which the UI already renders.

So `sessions.status` is gone, along with the `session_status` enum: `ended_at`
is the whole status, and a session is running exactly while it is null. The
amber "In progress" badge is gone from the list with it, and the delete dialog
no longer has a branch for a session still running.

The state machine gained an `END` event from `awaiting_answer`, landing on
`generating_report` — the same terminal path the final answer takes.

## Why

An in-progress row was a state nothing could leave. Sessions accumulated in the
list wearing an amber badge that meant "abandoned", and the delete dialog had to
explain the difference. The status column and `ended_at` also said the same
thing twice, and two columns encoding one fact can disagree; a timestamp cannot
disagree with itself.

Ending on the way out is also the honest reading of what leaving means. An
interview you walked out of is over. Practising one is not something you resume
three days later from the middle.

Only the answered turns go to the generator. A report marking you on questions
you never heard would be worse than no report.

## Pros

- One column, one fact. Nothing to reconcile.
- Every session in the list is finished, so the badge only has to report the
  report.
- Walking out after two answers still gets you feedback on those two.

## Cons

- The exit is destructive, so it needs a confirmation dialog in front of it.
- Closing the tab is not leaving: that session keeps `ended_at` null and is
  re-entered by URL. Enforcing it there needs a sweep, which is not built.
- A session cannot be paused. There is nothing to come back to by design, but
  the choice is now the app's rather than the user's.
