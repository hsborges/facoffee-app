import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema.js';

/** Database or transaction: repositories accept both. */
export type Executor = PgDatabase<NodePgQueryResultHKT, typeof schema>;

/** Connects to PostgreSQL and applies pending migrations from `drizzle/`. */
export const connectDatabase = async (url: string) => {
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../drizzle', import.meta.url)),
  });
  return {
    db,
    isHealthy: () =>
      db.execute(sql`select 1`).then(
        () => true,
        () => false,
      ),
    close: () => pool.end(),
  };
};
