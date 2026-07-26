import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './client.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

async function run(url: string) {
  const connection = createDatabase(url);
  try {
    await migrate(connection.db, { migrationsFolder: './migrations' });
    console.info('Database migrations completed.');
  } finally {
    await connection.pool.end();
  }
}

void run(databaseUrl);
