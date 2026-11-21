import './tracing';
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { setupSwagger } from './shared/infra/http/swagger.setup';
import { EnvironmentVariables } from './shared/infra/config/env.validation';

async function bootstrap() {
  const nest = await NestFactory.create(AppModule, { bufferLogs: true });
  nest.useLogger(nest.get(Logger));
  const app = configureApp(nest);
  setupSwagger(app);
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}
bootstrap();
