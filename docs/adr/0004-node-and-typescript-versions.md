# 4. Node 24 and TypeScript 7, with no build step

## Decision

Node 24.19.0 LTS, pinned in `.nvmrc` and in the root `engines` field.
TypeScript 7.0.2. pnpm 11, pinned via `packageManager` and resolved by Corepack.

`tsconfig.base.json` sets `module: "preserve"`, `moduleResolution: "bundler"`
and `noEmit: true`. TypeScript is only a type checker; source is executed
directly by tooling that already transpiles (`tsx`, Vite).

## Why

The machine was on Node 20, which is past end of life. Pinning the current LTS
avoids revisiting it later. Skipping emit means no build output to configure,
stage or clean for an app that only runs locally.

## Pros

- One tsconfig base, extended per package.
- Extensionless relative imports, no `.js` suffixes on TypeScript imports.
- Nothing to rebuild between editing a file and running a test.

## Cons

- TypeScript 7 is the native compiler rewrite. If a later tool in the chain
  cannot parse its output or plug into its API, the fallback is pinning back to
  the 6.x line; nothing here depends on 7-only syntax.
- There is no production build. Shipping this anywhere other than a local
  machine means adding one.
