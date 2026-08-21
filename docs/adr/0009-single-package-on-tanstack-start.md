# 9. A single package on TanStack Start, in SPA mode

Supersedes [0001](0001-monorepo-layout.md).
Amends [0002](0002-three-layer-test-split.md).

## Decision

One package at the repo root, no pnpm workspaces. TanStack Start replaces the
Vite SPA and the separate Hono API, running in SPA mode (`spa: { enabled: true
}`): the build prerenders one shell and the browser renders every route, so
there is no SSR. Data access is server functions validated with Zod, calling
the same services the Hono routes called.

## Why

Requested directly. One `package.json`, one dev command, and server functions
that are typed end to end, so there is no fetch wrapper or hand-written
response type.

## Pros

- Schema, state machine, AI client and services carried over untouched.
- No CORS, no proxy, no second process. Server functions still run server-side,
  so the database URL and API key never reach the browser.

## Cons

- A server bundle and a deploy target now exist, which v1 wanted to avoid.
- **Integration tests cannot cross the boundary.** Server functions need the
  Start runtime and throw under Vitest, so tests moved down to the services.
