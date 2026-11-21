import type { TestApp } from './helpers/test-app';
import { Test } from '@nestjs/testing';
import IORedis from 'ioredis';
import request from 'supertest';
import { configureApp } from '../src/app.setup';

describe('Rate limiting (e2e)', () => {
  let app: TestApp;
  let previous: string | undefined;

  // os contadores ficam no Redis e sobrevivem entre execuções: sem limpar, a segunda rodada em 60s já começa bloqueada
  async function clearThrottleKeys() {
    const redis = new IORedis(process.env.REDIS_URL!);
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
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
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong-password' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });

  it('envia os cabeçalhos do helmet', async () => {
    const res = await request(app.getHttpServer()).get('/v1/orders');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
