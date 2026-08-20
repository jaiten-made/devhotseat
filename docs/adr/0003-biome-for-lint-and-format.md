# 3. Biome for lint and format

## Decision

Biome 2.5 provides both linting and formatting, configured by a single
`biome.json` at the repo root. No ESLint, no Prettier.

## Why

One dependency and one config file instead of an ESLint flat config plus a
parser, a plugin set, and a Prettier config that has to be kept from fighting
it. For a single-user repo the ESLint ecosystem's extra rule coverage does not
pay for its setup cost.

## Pros

- One command (`pnpm lint`) checks formatting, lint rules and import order.
- Ships the React hook correctness rules that matter most here
  (`useExhaustiveDependencies`, `useHookAtTopLevel`), which is the class of bug
  the front-end rules are trying to prevent.
- No formatter/linter disagreement to arbitrate.

## Cons

- Smaller rule catalogue than the ESLint ecosystem.
- There is no Biome equivalent of `@tanstack/eslint-plugin-query`, so "every
  mutation invalidates the queries it affects" stays a review-time rule rather
  than something a tool enforces. If that turns out to be a recurring mistake,
  the fix is to add ESLint back for that one plugin and leave formatting with
  Biome.
