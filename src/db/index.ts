import * as schema from "./schema";
import type { PgliteDatabase } from "drizzle-orm/pglite";

/**
 * Tri-mode database client:
 *  - DATABASE_URL @ *.neon.tech -> Neon serverless driver (HTTP)
 *  - DATABASE_URL anything else -> node-postgres (self-hosted Postgres/docker)
 *  - DATABASE_URL unset -> embedded PGlite stored under .data/pglite (local dev,
 *    zero setup — same Postgres dialect, same Drizzle schema)
 */

export type Database = PgliteDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __iatreioDb?: Database };

function createDb(): Database {
  const url = process.env.DATABASE_URL;
  if (url) {
    if (/\.neon\.tech/.test(url)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { drizzle } = require("drizzle-orm/neon-http") as typeof import("drizzle-orm/neon-http");
      return drizzle(url, { schema }) as unknown as Database;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
    return drizzle(url, { schema }) as unknown as Database;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  return drizzle(process.env.PGLITE_PATH ?? ".data/pglite", { schema }) as unknown as Database;
}

/** Lazy proxy: the client (and PGlite's wasm) initializes on first query, never at build time. */
function lazyDb(): Database {
  return new Proxy({} as Database, {
    get(_target, prop) {
      const real = (globalForDb.__iatreioDb ??= createDb());
      const value = real[prop as keyof Database];
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
    },
  });
}

export const db: Database = lazyDb();

export * as tables from "./schema";
