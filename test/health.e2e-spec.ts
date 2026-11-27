import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestApp } from './helpers/test-app.js';
import { Test } from '@nestjs/testing';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { RedisHealthIndicator } from '#shared/infra/health/redis-health.indicator';
import { configureApp } from '../src/app.setup.js';
import { fakePing } from './helpers/health.js';

describe('Health (e2e)', () => {
  let app: TestApp;
  let dbUp = true;
  let redisUp = { cache: true, queue: true };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue({ pingCheck: fakePing(() => dbUp) })
      .overrideProvider(RedisHealthIndicator)
      .useValue({
        pingCheck: fakePing((key) => (key === 'redis-cache' ? redisUp.cache : redisUp.queue)),
      })
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());

  it('live e ready respondem 200 sem token e sem prefixo de versão', async () => {
    dbUp = true;
    redisUp = { cache: true, queue: true };
    await request(app.getHttpServer()).get('/health/live').expect(200);
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      info: {
        database: { status: 'up' },
        'redis-cache': { status: 'up' },
        'redis-queue': { status: 'up' },
      },
    });
  });

  it('com o banco indisponível, ready falha e live continua respondendo', async () => {
    dbUp = false;
    const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
    // o 503 do health fica fora do Problem Details: a resposta mostra qual indicador caiu
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body).toMatchObject({ status: 'error', error: { database: { status: 'down' } } });
    await request(app.getHttpServer()).get('/health/live').expect(200);
  });

  it.each([
    { down: 'cache', key: 'redis-cache', other: 'redis-queue' },
    { down: 'queue', key: 'redis-queue', other: 'redis-cache' },
  ] as const)(
    'com a conexão $down do Redis fora, ready falha só nela e live continua respondendo',
    async ({ down, key, other }) => {
      dbUp = true;
      redisUp = { cache: true, queue: true, [down]: false };
      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
      expect(res.body).toMatchObject({
        status: 'error',
        error: { [key]: { status: 'down' } },
        info: { [other]: { status: 'up' } },
      });
      expect(res.body.error).not.toHaveProperty(other);
      await request(app.getHttpServer()).get('/health/live').expect(200);
    },
  );
});
