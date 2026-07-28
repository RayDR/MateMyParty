import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const migrationDirectory = resolve(__dirname, '../migrations');
const migrationSuite = migrationUrl ? describe : describe.skip;
let client: Client;

migrationSuite('production baseline migrations', () => {
  beforeAll(async () => {
    const parsed = new URL(migrationUrl!);
    if (parsed.pathname !== '/matemyparty_migration_test') {
      throw new Error('Migration tests require the dedicated matemyparty_migration_test database');
    }
    client = new Client({ connectionString: migrationUrl });
    await client.connect();
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
  });

  afterAll(async () => {
    await client?.end();
  });

  it('applies every migration after the current production baseline', async () => {
    const migrationFiles = (await readdir(migrationDirectory))
      .filter((filename) => /^\d{4}_.+[.]sql$/.test(filename))
      .sort();
    expect(migrationFiles.slice(0, 2)).toEqual([
      '0000_bright_nightmare.sql',
      '0001_real_stingray.sql',
    ]);

    for (const filename of migrationFiles.slice(0, 2)) await applyMigration(filename);
    await insertProductionBaseline();
    for (const filename of migrationFiles.slice(2)) await applyMigration(filename);

    const localizations = await client.query<{ event_id: string; locale: string; title: string }>(
      `SELECT event_id, locale, title
       FROM event_localizations
       WHERE event_id = $1
       ORDER BY locale`,
      ['22222222-2222-4222-8222-222222222222'],
    );
    expect(localizations.rows).toEqual([
      {
        event_id: '22222222-2222-4222-8222-222222222222',
        locale: 'en-US',
        title: 'Raymundo’s 6th Birthday',
      },
      {
        event_id: '22222222-2222-4222-8222-222222222222',
        locale: 'es-MX',
        title: 'Sexto cumpleaños de Raymundo',
      },
    ]);
    await expectTable('email_delivery_attempts');
  });
});

async function applyMigration(filename: string) {
  const sql = await readFile(resolve(migrationDirectory, filename), 'utf8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
  await client.query('BEGIN');
  try {
    for (const statement of statements) await client.query(statement);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function insertProductionBaseline() {
  await client.query(
    `INSERT INTO users (id, email, display_name, locale)
     VALUES ($1, $2, $3, $4)`,
    ['11111111-1111-4111-8111-111111111111', 'owner@example.test', 'Event Owner', 'en-US'],
  );
  await client.query(
    `INSERT INTO events (
       id, owner_user_id, title, celebrant_name, celebrant_age, event_type,
       starts_at, timezone, locale, venue_name, public_slug, template_key, template_version,
       host_message
     ) VALUES ($1, $2, $3, $4, $5, 'KIDS_BIRTHDAY', $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      'Raymundo’s 6th Birthday',
      'Raymundo',
      6,
      '2026-08-06T18:00:00.000Z',
      'America/Chicago',
      'en-US',
      'Celebration Center',
      'raymundo-6',
      'kids-night-dragon',
      1,
      'Join us to celebrate.',
    ],
  );
}

async function expectTable(tableName: string) {
  const result = await client.query<{ table_name: string | null }>(
    'SELECT to_regclass($1)::text AS table_name',
    [`public.${tableName}`],
  );
  expect(result.rows[0]?.table_name).toBe(tableName);
}
