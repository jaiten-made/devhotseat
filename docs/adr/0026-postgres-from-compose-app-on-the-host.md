# 26. Postgres runs from compose, the app runs on the host

## Decision

`compose.yaml` at the repo root runs Postgres 18 and nothing else. It sets the
role and dev database through `POSTGRES_USER` / `POSTGRES_DB`, and
`docker/init-test-db.sql` creates `devhotseat_test` beside it. The port binds to
`127.0.0.1:5432`, the data lives in a named volume, and a `pg_isready`
healthcheck lets `docker compose up -d --wait` return only once the server will
answer.

The app is not containerised. `pnpm dev` still runs on the host.

The hand-rolled macOS and Linux install steps stay in the README, collapsed
behind a `<details>` as the alternative.

## Why

Open sourcing it. Installing Postgres by hand is the one setup step that
differs per machine, and the pinned major version had been rewritten three
times in the five commits before this — 16 to 17 to 18 — while the prerequisite
table still claimed 16+. That is a docs-maintenance cost that grows with every
platform someone tries it on.

Containerising the app as well would buy nothing. The run mode is a Vite dev
server, `playwright.config.ts` spawns `pnpm dev --port 3100` itself, and the
speech APIs need a real browser on the host whatever serves the page. A
container around that means bind mounts, HMR over a mount boundary, and pnpm's
symlinked `node_modules` — all cost, no benefit.

Both paths stay because the tool is a local one. Somebody who already runs
Postgres should not have to install Docker to try it.

## Pros

- One command replaces about thirty lines of platform-divergent README, and it
  creates both databases rather than three `psql` invocations creating one each.
- The Postgres major version is pinned in a file that is actually executed,
  rather than in prose that drifts.
- `--wait` plus the healthcheck removes the race that made `db:migrate`
  intermittently fail against a just-started server.
- A CI job can use the same image and the same init script.

## Cons

- Two supported setup paths to keep working, and only the compose one gets
  exercised regularly.
- The image's `POSTGRES_USER` is a superuser. That matches what the macOS
  instructions granted anyway, but it is not least privilege.
- Port 5432 collides with a host Postgres already listening, and the failure
  surfaces as a Docker port-bind error rather than anything about Postgres.

## The 18+ data directory change, found by testing

Mounting the volume at `/var/lib/postgresql/data` — correct for every image up
to 17, and what most compose files still say — makes the 18 images refuse to
start: they keep data in a major-version subdirectory and read that path as an
unused mount holding foreign data. The mount goes at `/var/lib/postgresql`.
