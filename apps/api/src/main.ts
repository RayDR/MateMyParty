import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { validateHostAdminConfiguration } from './auth/host-admin-token.guard';
import { ApiExceptionFilter } from './common/api-exception.filter';

async function bootstrap() {
  validateHostAdminConfiguration(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors();
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT ?? 3001), '0.0.0.0');
}

void bootstrap();
