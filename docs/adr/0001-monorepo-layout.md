# 1. Monorepo layout

## Decision

A pnpm workspace globbing `packages/*`, holding `@hotseat/db` (schema and
migrations), `@hotseat/api` (server, state machine, Vertex client) and
`@hotseat/web` (Vite SPA). Each is created in the milestone that needs it.

There is no shared `core` package. `SESSION_LENGTH` lives in
`packages/api/src/config.ts` and reaches the browser over HTTP rather than
through an import.

## Why

One local user, one machine. A fourth package existing only to hold a single
constant costs more than it saves. The state machine and the session length
are both server-owned, so they belong with the server.

## Pros

- Three packages map to the three things that exist: a schema, a server, a
  browser app.
- No build step between packages: TypeScript source is consumed directly.
- The session length has exactly one home, so it cannot drift.

## Cons

- The web app cannot read server constants at compile time, so rendering "you
  need N more questions" costs an extra request.
- If a second server-side consumer appears (a CLI, a background worker), the
  machine and constants would have to be lifted into a new `@hotseat/core`
  package and every import updated.
