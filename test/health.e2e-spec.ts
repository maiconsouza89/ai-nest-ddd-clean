import { describe, it, beforeAll, afterAll } from 'vitest';
import type { TestApp } from './helpers/test-app.js';
import { Test } from '@nestjs/testing';
import { HealthIndicatorService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { RedisHealthIndicator } from '#shared/infra/health/redis-health.indicator';
import { configureApp } from '../src/app.setup.js';

// devolve o builder real do terminus: qualquer encadeamento do controller (`.withTimeout()` etc.) funciona
const indicators = new HealthIndicatorService();
const fakePing = (key: string, isUp: () => boolean) =>
  indicators.check(key).attempt(() => {
    if (!isUp()) throw new Error(`${key} down`);
  });

describe('Health (e2e)', () => {
  let app: TestApp;
  let dbUp = true;
  let redisUp = true;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue({ pingCheck: (key: string) => fakePing(key, () => dbUp) })
      .overrideProvider(RedisHealthIndicator)
      .useValue({ pingCheck: (key: string) => fakePing(key, () => redisUp) })
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());

  it('live e ready respondem 200 sem token e sem prefixo de versão', async () => {
    dbUp = true;
    redisUp = true;
    await request(app.getHttpServer()).get('/health/live').expect(200);
    await request(app.getHttpServer()).get('/health/ready').expect(200);
  });

  it('com o banco indisponível, ready falha e live continua respondendo', async () => {
    dbUp = false;
    await request(app.getHttpServer()).get('/health/ready').expect(503);
    await request(app.getHttpServer()).get('/health/live').expect(200);
  });

  it('com o Redis indisponível, ready falha e live continua respondendo', async () => {
    dbUp = true;
    redisUp = false;
    await request(app.getHttpServer()).get('/health/ready').expect(503);
    await request(app.getHttpServer()).get('/health/live').expect(200);
  });
});
