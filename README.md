# devhotseat

An AI interview practice tool built for one person to run on their own machine.
Add interview questions by hand, practise a session of them one turn at a time,
then read the transcript and an AI-written feedback report afterwards. There is
no auth, no multi-tenancy and no hosted deployment: it runs locally.

## Prerequisites

| Tool | Version |
| ---- | ------- |
| Node | 24.19.0 (see `.nvmrc`) |
| pnpm | 11.22.0 (pinned via `packageManager`; pnpm fetches the pinned version itself) |
| PostgreSQL | 16+, listening on 5432 |
| Browser | Google Chrome. Speech recognition is a hosted service that Brave and some other Chromium builds ship without. |

```bash
nvm install && nvm use
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

## Setup

From the repository root:

```bash
pnpm install
```

Create the database role and both databases:

### macOS (Homebrew)

```bash
# 1. Install and start PostgreSQL
brew install postgresql@18
brew services start postgresql@18

# 2. Ensure psql is available in PATH
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"

# 3. Create role and databases
psql postgres -c "CREATE ROLE devhotseat LOGIN PASSWORD 'devhotseat' SUPERUSER;"
psql postgres -c "CREATE DATABASE devhotseat OWNER devhotseat;"
psql postgres -c "CREATE DATABASE devhotseat_test OWNER devhotseat;"
```

### Linux (Debian / Ubuntu)

```bash
# 1. Start PostgreSQL service
sudo systemctl enable --now postgresql@18-main

# 2. Create role and databases
sudo -u postgres psql -p 5432 -c "CREATE ROLE devhotseat LOGIN PASSWORD 'devhotseat';"
sudo -u postgres createdb -p 5432 -O devhotseat devhotseat
sudo -u postgres createdb -p 5432 -O devhotseat devhotseat_test
```

Copy the environment template. Adjust the connection strings if you changed
anything above, and set `GEMINI_API_KEY` to a Google Gemini API key — feedback
report generation needs it:

```bash
cp .env.example .env
```

Apply the migrations, to the dev database and then to the test one the
integration and e2e suites use:

```bash
pnpm db:migrate
```

```bash
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate
```

## Running it

```bash
pnpm dev
```

The app is served at http://localhost:3000. Add questions on the first page,
start a session once the bank holds at least one, then read the transcript and
report from **Sessions**. A session asks every question in the bank, in random
order, reading each one aloud and transcribing your spoken answer. It runs as a
call screen: entering it reads nothing out until you press to begin, after
which the bar across the bottom is pressed once to start talking and again to
hand your answer back, and the avatar in the middle is green only while the
microphone is actually open. You can press to talk over a question
that is still being read, which stops it. Replaying the question and showing
the answers so far sit under the bar.

Before the first press the room shows a short briefing rather than the question,
which is not revealed until it is spoken. **End interview** in the header is the
one way out, and it ends the session there and then: the report is written from
the answers given so far, and you cannot return to it. An interview is never
left in progress. Typing is available at any time via **Type**, and is used
automatically when the browser has no speech support or the microphone is
refused. A session you do not want to keep can be deleted from the **Sessions**
list; its transcript and report go with it.

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
| `src/components/interview` | The call screen: avatar, controls, transcript panel |
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
