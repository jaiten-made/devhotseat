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

Create the database role and the dev database:

```bash
sudo systemctl enable --now postgresql@18-main && sudo -u postgres psql -p 5432 -c "CREATE ROLE hotseat LOGIN PASSWORD 'hotseat'" && sudo -u postgres createdb -p 5432 -O hotseat hotseat
```

Copy the environment template and adjust `DATABASE_URL` if you changed anything
above:

```bash
cp .env.example .env
```

Apply the migrations:

```bash
pnpm --filter @hotseat/db migrate
```

## Testing

| Command | Layer | Covers |
| ------- | ----- | ------ |
| `pnpm test:unit` | Vitest, colocated `*.test.ts` | Pure logic — no database, no network |
| `pnpm test:integration` | Vitest, `*.integration.test.ts` | HTTP endpoints against a real Postgres test database |
| `pnpm test:e2e` | Playwright | The UI driven against the running local stack |

`pnpm test` runs all three in order. Only the unit layer has specs today; the
other two are wired up and do nothing until the API and UI exist.

Other checks:

```bash
pnpm typecheck
pnpm lint
```

## Project layout

| Path | Contents |
| ---- | -------- |
| `packages/api` | Session state machine, and the values that must not be duplicated client-side |
| `packages/db` | Drizzle schema, generated migrations, database client |
| `docs/adr` | Decision records |

## Decisions

The reasoning behind each technical choice lives in [`docs/adr/`](docs/adr/).
