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
  const REDIS_KEYS = ['redis-cache', 'redis-queue'] as const;
  let redisUp: Record<string, boolean> = { 'redis-cache': true, 'redis-queue': true };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue({ pingCheck: fakePing(() => dbUp) })
      .overrideProvider(RedisHealthIndicator)
      .useValue({ pingCheck: fakePing((key) => redisUp[key]) })
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());

  it('live e ready respondem 200 sem token e sem prefixo de versão', async () => {
    dbUp = true;
    redisUp = { 'redis-cache': true, 'redis-queue': true };
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

  it.each(REDIS_KEYS)(
    'com %s fora, ready falha só nela e live continua respondendo',
    async (key) => {
      const other = REDIS_KEYS.find((k) => k !== key)!;
      dbUp = true;
      redisUp = { [key]: false, [other]: true };
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
