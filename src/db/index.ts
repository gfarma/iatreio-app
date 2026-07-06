import * as schema from "./schema";
import type { PgliteDatabase } from "drizzle-orm/pglite";

/**
 * Dual-mode database client:
 *  - DATABASE_URL set  -> Neon serverless Postgres (production / Vercel)
 *  - DATABASE_URL unset -> embedded PGlite stored under .data/pglite (local dev,
 *    zero setup — same Postgres dialect, same Drizzle schema)
 */

export type Database = PgliteDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __iatreioDb?: Database };

function createDb(): Database {
  if (process.env.DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/neon-http") as typeof import("drizzle-orm/neon-http");
    return drizzle(process.env.DATABASE_URL, { schema }) as unknown as Database;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  return drizzle(process.env.PGLITE_PATH ?? ".data/pglite", { schema }) as unknown as Database;
}

export const db: Database = globalForDb.__iatreioDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__iatreioDb = db;

export * as tables from "./schema";
