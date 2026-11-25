import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { TestApp } from './helpers/test-app.js';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import request from 'supertest';
import { configureApp } from '../src/app.setup.js';
import { expectProblemJson } from './helpers/problem.js';

describe('Rate limiting (e2e)', () => {
  let app: TestApp;
  const env = ['THROTTLE_ENABLED', 'TRUST_PROXY'];
  const previous: Record<string, string | undefined> = {};

  // os contadores ficam no Redis e sobrevivem entre execuções: sem limpar, a segunda rodada em 60s já começa bloqueada
  async function clearThrottleKeys(pattern = 'throttle:*') {
    const redis = new Redis(process.env.REDIS_URL!);
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    } finally {
      redis.disconnect();
    }
  }

  // cada requisição de um IP próprio (TRUST_PROXY=1): só o limite por conta age
  let nextIp = 0;
  function loginFrom(email: string) {
    nextIp++;
    return request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('X-Forwarded-For', `10.0.0.${nextIp}`)
      .send({ email, password: 'wrong-password' });
  }

  async function statusesOf(email: string, attempts: number) {
    const statuses = [];
    for (let i = 0; i < attempts; i++) statuses.push((await loginFrom(email)).status);
    return statuses;
  }

  beforeAll(async () => {
    await clearThrottleKeys();
    for (const name of env) previous[name] = process.env[name];
    process.env.THROTTLE_ENABLED = 'true';
    process.env.TRUST_PROXY = '1';
    // o ConfigModule valida o env quando o AppModule é importado, então o import vem depois do env
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await clearThrottleKeys();
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  beforeEach(() => clearThrottleKeys());

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

  it('limita a mesma conta vinda de IPs diferentes', async () => {
    const responses = [];
    for (let i = 0; i < 6; i++) responses.push(await loginFrom('victim@example.com'));
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 429]);
    const limited = responses[5];
    expectProblemJson(limited);
    expect(limited.body).toMatchObject({ status: 429, code: 'TOO_MANY_REQUESTS' });
    expect(limited.headers['retry-after']).toMatch(/^\d+$/);
  });

  it('conta o e-mail normalizado: maiúsculas e espaços caem no mesmo balde', async () => {
    expect(await statusesOf('victim@example.com', 3)).toEqual([401, 401, 401]);
    // o @IsEmail do DTO recusa os espaços (400), mas o guard roda antes e já contou a tentativa
    expect(await statusesOf('  Victim@Example.COM ', 3)).toEqual([400, 400, 429]);
  });

  it('mantém as outras contas livres', async () => {
    await statusesOf('victim@example.com', 6);
    expect((await loginFrom('other@example.com')).status).toBe(401);
  });

  it('bloqueia pelo degrau da hora depois de 20 tentativas', async () => {
    for (let round = 0; round < 4; round++) {
      expect(await statusesOf('victim@example.com', 5)).toEqual([401, 401, 401, 401, 401]);
      // simula o minuto que passou: apaga só a contagem e o bloqueio do degrau do minuto
      await clearThrottleKeys('throttle:{account-minute:*');
    }
    const limited = await loginFrom('victim@example.com');
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toMatch(/^\d+$/);
  });

  it('envia os cabeçalhos do helmet', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
