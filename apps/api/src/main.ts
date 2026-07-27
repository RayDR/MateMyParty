import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { parseEnvironment } from '@matemyparty/config';
import { AppModule } from './app.module';
import { validateHostAdminConfiguration } from './auth/host-admin-token.guard';
import { ApiExceptionFilter } from './common/api-exception.filter';

async function bootstrap() {
  const environment = parseEnvironment(process.env);
  validateHostAdminConfiguration(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: 'loopback' }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(environment.API_PORT, environment.API_HOST);
}

void bootstrap();
