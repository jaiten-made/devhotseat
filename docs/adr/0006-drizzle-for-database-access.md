# 6. Drizzle for database access and migrations

## Decision

Drizzle ORM for queries, Drizzle Kit for migrations. The schema lives in
`@hotseat/db` and is the single definition of every row shape; API and web take
their types from it via `$inferSelect` / `$inferInsert`.

Migrations are generated as SQL files and committed. The package defines
`generate` and `migrate`, and deliberately not `push`.

## Why

The schema is already TypeScript, so types come out of it for free with no
hand-written duplicate to drift. Generated SQL is readable and can be checked
before it touches a database holding transcripts.

Prisma needs a separate schema language and generated client; Kysely does not
generate migrations from a schema; raw SQL gives up types.

## Pros

- One definition, no duplicate row types across packages.
- The migration is reviewable SQL, not an opaque sync.
- With no `push` script in the package, "never push at the dev database" is
  structural rather than remembered.

## Cons

- Drizzle is pre-1.0, so minor bumps can break.
- Generated migration filenames are random words; `meta/_journal.json` is the
  real ordering.
- Complex joins may fall back to the query builder or raw SQL.
