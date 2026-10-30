import "server-only";
import { Pool, type QueryResultRow } from "pg";

/**
 * PostgreSQL connection pool.
 *
 * Cached on globalThis so Next.js dev-mode hot reloads do not open a new pool
 * on every edit. In production there is exactly one module instance anyway.
 */
const globalForPg = globalThis as unknown as { __alumniPool?: Pool };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — see .env.example");
  }
  return new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export function getPool(): Pool {
  if (!globalForPg.__alumniPool) {
    globalForPg.__alumniPool = createPool();
  }
  return globalForPg.__alumniPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

/** True when a connection can be made — used to degrade gracefully at build time. */
export async function dbReachable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await getPool().query("select 1");
    return true;
  } catch {
    return false;
  }
}
