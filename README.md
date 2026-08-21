# dev-hotseat

An AI interview practice tool built for one person to run on their own machine.
Add interview questions by hand, practise a session of them one turn at a time,
then read the transcript and an AI-written feedback report afterwards. There is
no auth, no multi-tenancy and no hosted deployment: it runs locally.

## Prerequisites

| Tool | Version |
| ---- | ------- |
| Node | 24.19.0 (see `.nvmrc`) |
| pnpm | 11.22.0 (pinned via `packageManager`, provided by Corepack) |
| PostgreSQL | 18.6, listening on 5432 |
| Browser | Google Chrome. Speech recognition is a hosted service that Brave and some other Chromium builds ship without. |

```bash
nvm install && nvm use && corepack enable
```

## Setup

From the repository root:

```bash
pnpm install
```

Create the database role and both databases:

```bash
sudo systemctl enable --now postgresql@18-main && sudo -u postgres psql -p 5432 -c "CREATE ROLE hotseat LOGIN PASSWORD 'hotseat'" && sudo -u postgres createdb -p 5432 -O hotseat hotseat && sudo -u postgres createdb -p 5432 -O hotseat hotseat_test
```

Copy the environment template. Adjust the connection strings if you changed
anything above, and set `GEMINI_API_KEY` to a Google Gemini API key — feedback
report generation needs it:

```bash
cp .env.example .env
```

Apply the migrations:

```bash
pnpm db:migrate
```

## Running it

```bash
pnpm dev
```

The app is served at http://localhost:3000. Add questions on the first page,
start a session once the bank holds at least one, then read the transcript and
report from **Sessions**. A session asks every question in the bank, in random
order, reading each one aloud and transcribing your spoken answer. It runs as a
call screen: the avatar in the middle pulses while the question is being read
and turns green while the microphone is open, and the controls along the bottom
submit the answer, replay the question, show the answers so far, or leave.
Typing is available at any time via **Type**, and is used automatically when
the browser has no speech support or the microphone is refused.

## Testing

| Command | Layer | Covers |
| ------- | ----- | ------ |
| `pnpm test:unit` | Vitest, colocated `*.test.ts` | Pure logic — no database, no network |
| `pnpm test:integration` | Vitest, `*.integration.test.ts` | Services against a real Postgres test database, with the report generator stubbed |
| `pnpm test:e2e` | Playwright, `e2e/` | The UI driven against the running stack, with report generation stubbed |

`pnpm test` runs all three in order. The integration and e2e suites use the
test database, truncate between runs, and refuse to start unless the database
name ends in `_test`, so the dev database is never touched.

Playwright needs its browser once:

```bash
pnpm exec playwright install chromium
```

Other checks:

```bash
pnpm typecheck
pnpm lint
```

## Project layout

| Path | Contents |
| ---- | -------- |
| `src/routes` | TanStack Router file routes and the app shell |
| `src/components/ui` | shadcn/ui components |
| `src/components/interview` | The call screen: avatar, controls, transcript drawer |
| `src/lib` | Query keys, query options, and the voice loop |
| `src/fn` | Server functions — the boundary the browser calls |
| `src/server/services` | Question bank and session logic |
| `src/server/session` | The interview state machine |
| `src/server/db` | Drizzle schema and database client |
| `src/server/ai` | Report generator and its prompt |
| `migrations` | Generated SQL migrations |
| `e2e` | Playwright specs |
| `docs/adr` | Decision records |

## Decisions

The reasoning behind each technical choice lives in [`docs/adr/`](docs/adr/).
