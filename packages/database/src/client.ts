import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}

export type DatabaseConnection = ReturnType<typeof createDatabase>;
export type DatabaseExecutor = Parameters<
  Parameters<DatabaseConnection['db']['transaction']>[0]
>[0];
