# 20. Deleting a session leans on the database

## Decision

Deleting a session is one `DELETE` against `sessions`. Its turns and its report
go with it through the `ON DELETE CASCADE` on those foreign keys, so there is no
fan-out in TypeScript and no statement order to get wrong. The service returns
whether a row matched; the UI asks first, as deleting a question does.

Any status can be deleted. Nothing ends a session early (ADR 12), so deletion is
the only way to clear an abandoned one.

An integration test asserts the `turns` and `reports` rows are gone afterwards,
rather than trusting the schema.

## Why

The database already knows what belongs to a session. Restating that in
TypeScript is a second copy to keep in step.

## Pros

- Adding a child table later inherits the delete by declaring its own cascade.
- No partial delete: Postgres does the whole thing or none of it.

## Cons

- The cascade is invisible from the calling code; the test is what documents it.
- Nothing is recoverable. There is no soft delete and no undo, so a mis-click
  behind the confirm dialog loses a transcript for good.
