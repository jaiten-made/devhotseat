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

```bash
nvm install && nvm use && corepack enable
```

## Setup

From the repository root:

```bash
pnpm install
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
| `packages/api` | HTTP server and the values that must not be duplicated client-side |
| `docs/adr` | Decision records |

## Decisions

The reasoning behind each technical choice lives in [`docs/adr/`](docs/adr/).
