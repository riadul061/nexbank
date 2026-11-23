import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { pgPool?: Pool };

const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.VERCEL ? 3 : 10,
    ssl: process.env.DATABASE_URL?.includes('sslmode=') || process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
if (process.env.NODE_ENV !== 'production') globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export { pool };
