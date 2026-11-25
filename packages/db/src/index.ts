import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export * from "./schema";
export { schema };
export type Database = NodePgDatabase<typeof schema>;

interface DbOptions {
  url?: string;
  /** Keep this small on serverless: many instances, few connections each. */
  max?: number;
}

const globalForDb = globalThis as unknown as { __raktflowPool?: pg.Pool; __raktflowDb?: Database };

/**
 * One pool per process, reused across hot reloads and serverless invocations.
 * Neon's pooled URL fronts PgBouncer, so thousands of app instances share a
 * small number of real Postgres connections.
 */
export function getDb(options: DbOptions = {}): Database {
  if (globalForDb.__raktflowDb) return globalForDb.__raktflowDb;
  const connectionString = options.url ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({
    connectionString,
    max: options.max ?? Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  globalForDb.__raktflowPool = pool;
  globalForDb.__raktflowDb = drizzle(pool, { schema });
  return globalForDb.__raktflowDb;
}

export async function closeDb(): Promise<void> {
  await globalForDb.__raktflowPool?.end();
  globalForDb.__raktflowPool = undefined;
  globalForDb.__raktflowDb = undefined;
}
