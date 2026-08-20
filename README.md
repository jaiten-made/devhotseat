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

The app is served at http://localhost:3000.

## Testing

| Command | Layer | Covers |
| ------- | ----- | ------ |
| `pnpm test:unit` | Vitest, colocated `*.test.ts` | Pure logic — no database, no network |
| `pnpm test:integration` | Vitest, `*.integration.test.ts` | Services against a real Postgres test database, with the report generator stubbed |

`pnpm test` runs both in order. The integration suite truncates its database
between tests and refuses to run unless the name ends in `_test`.

Other checks:

```bash
pnpm typecheck
pnpm lint
```

## Project layout

| Path | Contents |
| ---- | -------- |
| `src/routes` | TanStack Router file routes and the app shell |
| `src/fn` | Server functions — the boundary the browser calls |
| `src/server/services` | Question bank and session logic |
| `src/server/session` | The interview state machine |
| `src/server/db` | Drizzle schema and database client |
| `src/server/ai` | Report generator and its prompt |
| `migrations` | Generated SQL migrations |
| `docs/adr` | Decision records |

## Decisions

The reasoning behind each technical choice lives in [`docs/adr/`](docs/adr/).
