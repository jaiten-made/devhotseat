# 9. A single package on TanStack Start

Supersedes [0001](0001-monorepo-layout.md). Amends
[0002](0002-three-layer-test-split.md).

## Decision

One package at the repo root, no pnpm workspaces. TanStack Start with SSR
replaces the Vite SPA plus separate Hono API. Data access is server functions
(`createServerFn`) validated with Zod, which call the same service layer the
Hono routes used to call.

## Why

Requested directly. One `package.json`, one `tsconfig`, one dev command, no
cross-package resolution. Server functions are typed end to end, so there is no
fetch wrapper and no hand-written response types.

## Pros

- The schema, state machine, AI client and services carried over untouched.
- Calling the server is a typed function call, not a URL and a cast.
- No CORS, no proxy, no second process to start.

## Cons

- Reverses the original non-goals: there is now SSR, a server bundle, and a
  deploy target to think about.
- **Integration tests can no longer cross the boundary.** Server functions need
  the Start runtime and throw "No Start context found" under Vitest, so tests
  moved down to the service layer. The thin validate-and-delegate wrappers are
  covered only by Playwright.
- No status codes left to assert on.
