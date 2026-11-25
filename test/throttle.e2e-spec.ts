import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestApp } from './helpers/test-app.js';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import request from 'supertest';
import { configureApp } from '../src/app.setup.js';
import { expectProblemJson } from './helpers/problem.js';

describe('Rate limiting (e2e)', () => {
  let app: TestApp;
  let previous: string | undefined;

  // os contadores ficam no Redis e sobrevivem entre execuções: sem limpar, a segunda rodada em 60s já começa bloqueada
  async function clearThrottleKeys() {
    const redis = new Redis(process.env.REDIS_URL!);
    try {
      const keys = await redis.keys('throttle:*');
      if (keys.length > 0) await redis.del(...keys);
    } finally {
      redis.disconnect();
    }
  }

  beforeAll(async () => {
    await clearThrottleKeys();
    previous = process.env.THROTTLE_ENABLED;
    process.env.THROTTLE_ENABLED = 'true';
    // o ConfigModule valida o env quando o AppModule é importado, então o import vem depois do env
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await clearThrottleKeys();
    if (previous === undefined) delete process.env.THROTTLE_ENABLED;
    else process.env.THROTTLE_ENABLED = previous;
  });

  it('devolve 429 após vários logins seguidos', async () => {
    const responses = [];
    for (let i = 0; i < 7; i++) {
      responses.push(
        await request(app.getHttpServer())
          .post('/v1/auth/login')
          .send({ email: 'nobody@example.com', password: 'wrong-password' }),
      );
    }
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 429, 429]);
    const limited = responses[5];
    expectProblemJson(limited);
    expect(limited.body).toMatchObject({
      title: 'Too Many Requests',
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      instance: '/v1/auth/login',
    });
  });

  it('envia os cabeçalhos do helmet', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
