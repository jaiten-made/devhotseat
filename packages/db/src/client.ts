import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>["db"];

/**
 * Builds a Drizzle client over a connection pool. The caller owns the pool and
 * is responsible for closing it, which is what lets the integration tests
 * point at the test database and tear it down between files.
 */
export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
