# dev-hotseat spec

An AI interview practice tool I built for my own use, running locally.

This describes the system as built. Where it differs from the original brief,
the reason is in [`docs/adr/`](adr/) rather than restated here. Three things
changed during the build: the monorepo became a single package, the separate
HTTP API became TanStack Start server functions, and Vertex AI became the
Gemini API.

## Naming

Use these exactly. Do not invent variations.

* Repo and root directory: `dev-hotseat`
* Root `package.json` name: `dev-hotseat`, private, never published
* Dev database: `hotseat`
* Test database: `hotseat_test`

There is no package scope. The `@hotseat/api`, `@hotseat/web` and `@hotseat/db`
packages existed briefly and were collapsed into one package (ADR 0009).

## Context

I built something similar before at https://github.com/jaiten-made/devprep
(Firebase-based). The state machine shape and the TanStack Query patterns come
from there. The Firebase layer does not: I moved off it.

## Single JTBD

Practice an interview, then review how it went. Four parts, one journey:

1. **Question bank.** I add interview questions by hand and they persist. I can
   see the list and delete from it.
2. **Session.** The app asks a question from the bank, I type an answer, it asks
   the next. Turn by turn, for a fixed number of questions. Every turn is saved
   to Postgres as it happens.
3. **Transcript view.** I can open a past session and read the full Q&A exchange
   in the UI.
4. **Feedback report.** When a session ends the AI produces a written report on
   my answers, saved alongside the transcript and viewable in the UI.

Feedback quality is explicitly v1-shallow. One prompt, prose out. No rubrics, no
per-answer scoring, no comparison against previous sessions. The point is that
the pipe exists and persists.

Input is typed text. Voice is not in v1 in any form.

## Where AI is and isn't used

The Gemini API is used for exactly one thing: generating the feedback report at
the end of a session. Questions come from the bank I filled in by hand. Nothing
calls the AI during the turn loop.

## Non-goals for v1

Do not build, do not scaffold for:

* AI-generated questions, question suggestions, or auto-populating the bank
* Follow-up questions, probing, or any question that adapts to what I answered
* Editing questions after creation. Add and delete only.
* Question categories, tags, difficulty, search, or ordering controls
* Variable session length, user-chosen length, early exit, or resume
* **SSR or server-rendered routes.** TanStack Start runs in SPA mode.
* TanStack Table, Form, or Virtual. The lists here are short and plain.
* Optimistic updates. Invalidate and refetch is fine at this scale.
* Auth / users / multi-tenancy
* Cloud deployment, Docker registries, CI/CD pipelines
* Scoring, grading, rubrics, numeric ratings
* Analytics, progress tracking, trends across sessions
* Editing or deleting sessions
* Voice, audio, speech-to-text, text-to-speech, and any test infrastructure for
  them
* Payments, email, notifications

Cloud comes later. Design so it isn't blocked, but don't build it now.

## Stack

* Single pnpm package. No workspaces.
* Node 24 LTS, TypeScript 7 as a type checker only, no emit
* TanStack Start in SPA mode, on Vite + React
* TanStack Router for routing, TanStack Query for all server state
* Server functions (`createServerFn`) for data access, validated with Zod
* shadcn/ui + Tailwind
* Postgres for storage, running as a local native cluster
* Drizzle ORM for all DB access, Drizzle Kit for migrations
* Biome for lint and format
* Vitest for unit and integration tests
* Playwright for end-to-end tests
* Google Gemini API (`@google/genai`) for the feedback report, authenticated
  with an API key
* Self-hosted, runs locally via `pnpm dev` and a local Postgres

Local dev tooling: pgAdmin for manual DB inspection. Dev convenience only. No
app code depends on it and it is not part of the runtime.

## Front-end rules

* TanStack Query owns all server state. No `useEffect` fetching, no manual
  loading flags, no server data duplicated into `useState`.
* Query keys live in one factory module (`src/lib/query-keys.ts`). Never inline.
* Mutations invalidate the queries they affect. Submitting an answer invalidates
  the session, so progress and the next question come from server state, not
  from a local counter.
* SPA mode. No SSR, no server-rendered routes.
* Query Devtools in development only, excluded from the production build.
* React state is for UI state only: form inputs, open dialogs, focus.

## AI setup

* `@google/genai`, initialised with an API key. No `vertexai` flag, no project,
  no location, no ADC, no service account, no gcloud.
* Vertex AI express mode was the original plan and is unreachable from a
  consumer Google account. See ADR 0008.
* The key lives in `.env` as `GEMINI_API_KEY`, with a placeholder in
  `.env.example`. Never in code, never committed.
* The model is one named constant, `REPORT_MODEL`, pinned to a concrete version
  rather than a `-latest` alias. Check it against the live model list when
  bumping it.
* If a call fails with an auth or key-blocked error, stop and tell me. Do not
  silently fall back to ADC or gcloud auth.
* Do not use Genkit in v1. It becomes the right choice when I add a second and
  third AI feature. The client stays behind a `ReportGenerator` interface so
  swapping to it later is contained to one file.

## Question bank rules

* Questions are added one at a time through the UI. Add and delete only.
* A session picks its questions at random from the bank.
* A session needs at least one question in the bank. Below that, block session
  start and say so. There is no minimum beyond one.
* A turn stores the question text, not a foreign key to it. Deleting a question
  later must not blank out or corrupt an old transcript.

## Session length

* A session asks up to a fixed number of questions. Default 5. That number is a
  ceiling, not a quota: a bank smaller than it gives a shorter session.
* The ceiling is one named constant, `SESSION_LENGTH` in `src/config.ts`. With
  a single package the browser imports it directly, but progress is still read
  from server data, never from a counter the UI keeps. The length actually used
  is snapshotted onto the session row, so sessions of different lengths coexist.
* The session ends automatically once the last answer is submitted, which
  triggers report generation. No end button, no early exit, no resume.
* The state machine owns the count.

## Feedback report rules

* Generated once, when the session ends. Persisted to Postgres. Never
  regenerated on view.
* If generation fails, the session and transcript still save. A session with no
  report is a valid state the UI must handle, not an error.
* Report generation is a terminal transition in the state machine, not a side
  effect bolted on after.
* The prompt lives in its own file (`src/server/ai/prompt.md`) so I can iterate
  on it without touching code.

## Drizzle rules

* Schema lives in one module, `src/server/db/schema.ts`, and every row type is
  inferred from it. No hand-written duplicate types.
* Migrations are generated with Drizzle Kit and committed. There is no `push`
  script, so it cannot be reached for by accident.
* Queries go through the Drizzle query builder. Raw SQL only where the builder
  genuinely can't express it, with a comment saying why. Currently one place in
  app code, `ORDER BY random()`, plus `TRUNCATE` in the test harness.

## Testing

Three layers, no overlap. Don't write a test that belongs in a lower layer.

**Vitest unit** (`*.test.ts`, colocated)

* State machine transitions: every valid transition, every rejected one,
  including auto-end on the last answer and the end-to-report path.
* Report prompt construction and response parsing.
* Pure functions only. No DB, no network.

**Vitest integration** (`*.integration.test.ts`)

* Exercises the service layer against a real Postgres test database. Real
  Drizzle, no mocking the DB. The report generator is stubbed at its client
  boundary.
* Server functions cannot be reached from Vitest: they need the Start runtime
  and throw without it. Input validation therefore lives in the services so it
  stays covered. See ADR 0009.
* Cover the full flow: add questions, start a session, post N answers, fetch the
  transcript, fetch the report.
* Also cover:
  * turns persist in order
  * the session auto-ends on the Nth answer and not before
  * answering an ended session is rejected
  * starting a session with an empty bank is rejected, and a bank smaller than
    the ceiling gives a correspondingly shorter session
  * deleting a question leaves old transcripts intact
  * a session with no report reads back cleanly
* Runs against `hotseat_test`, never the dev DB, and refuses to start unless the
  database name ends in `_test`.
* Truncate between tests. Each test sets up its own data.

**Playwright e2e** (`e2e/`)

* Drives the text UI only. No media permissions, no fake device flags, no audio
  fixtures.
* Thin by design. The integration layer already proves the flow works, so these
  prove the UI is wired to it.
* One happy path: add questions, start a session, type N answers, see the
  transcript, see the report.
* One spec for empty and failure states: empty question bank, no sessions yet,
  and a session whose report is missing.
* Runs the real stack against the test database with report generation stubbed.
  See ADR 0011.

### Test scripts

Script names are fixed: `test:unit`, `test:integration`, `test:e2e`. `test` runs
all three in order. No coverage thresholds. No snapshot tests. No mocking
Drizzle.

## README

A root `README.md` stays accurate throughout: what this is, prerequisites with
versions, copy-pasteable setup, how to run it, the three test commands, project
layout, and a link to `docs/adr/`.

* Document only what works right now. No roadmap, no "coming soon".
* Update it in the same commit as the change that made it stale.
* Every command in it must have been run and worked.
* No badges, no logo, no contributing section, no licence section.

## Decision records

Every technical decision gets an ADR in `docs/adr/NNNN-short-title.md`: what was
decided, why in KISS terms, pros, and cons including what we'd hit at scale.
Under 200 words each. Superseded records stay, annotated, rather than being
rewritten.

## Milestones

All ten are complete. The restructure to a single TanStack Start package
happened after milestone 5 and replaced its HTTP API.

1. Package scaffold, tooling, Vitest, test script fan-out, initial README
2. Drizzle schema and first migration applied to local Postgres
3. Gemini client for report generation, verified with one real call
4. Interview state machine with unit tests for all transitions
5. Data layer: question bank and session flow, with integration tests
6. UI for the question bank
7. UI for the turn-by-turn session, including the too-few-questions block
8. UI for session list, transcript view, and report view
9. Playwright installed and e2e specs passing against the local stack
10. End-to-end by hand: 8 questions, a full session, transcript and report read
    back in the UI

## Git rules

* Conventional Commits (`feat:`, `chore:`, `docs:`, `fix:`, `test:`,
  `refactor:`)
* One commit per milestone. Tests and README updates go in the same commit as
  the code they cover.
* Subject line under 72 chars, imperative mood
* Body: max 3 bullets, what changed and why. No filler.

## Working rules

* Verify before claiming done: run it, read back the file, check the DB row
  actually exists. Never describe an intended action as a completed one.
* No secrets in code or commits. `.env` + `.env.example` only.
* Ask one question at a time if something is genuinely ambiguous. Don't guess on
  schema or API shape.
* Tell me when you're unsure instead of inventing a library or API.
