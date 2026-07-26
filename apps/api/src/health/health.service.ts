import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { healthResponseSchema, type HealthResponse } from '@matemyparty/contracts';
import type { DatabaseConnection } from '@matemyparty/database';
import { DATABASE } from '../database/database.module';

@Injectable()
export class HealthService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  async check(): Promise<HealthResponse> {
    let database: 'up' | 'down' = 'up';
    try {
      await this.connection.db.execute(sql`select 1`);
    } catch {
      database = 'down';
    }
    return healthResponseSchema.parse({
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION ?? '0.1.0',
    });
  }
}
