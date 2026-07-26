import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { parseEnvironment } from '@matemyparty/config';
import { createDatabase, type DatabaseConnection } from '@matemyparty/database';

export const DATABASE = Symbol('DATABASE');

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: () => {
        const environment = parseEnvironment(process.env);
        return createDatabase(environment.DATABASE_URL);
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}
  async onApplicationShutdown() {
    await this.connection.pool.end();
  }
}
