import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestApp } from './helpers/test-app.js';
import { Test } from '@nestjs/testing';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import request from 'supertest';
import { RedisHealthIndicator } from '#shared/infra/health/redis-health.indicator';
import { configureApp } from '../src/app.setup.js';
import { fakePing } from './helpers/health.js';

const GRACE_MS = 1000;

// banco e Redis sempre "up": o único motivo do 503 é o desligamento
const alwaysUp = { pingCheck: fakePing() };

describe('Desligamento com atraso (e2e)', () => {
  let app: TestApp;
  let previous: string | undefined;

  beforeAll(async () => {
    previous = process.env.SHUTDOWN_GRACE_MS;
    process.env.SHUTDOWN_GRACE_MS = String(GRACE_MS);
    // o ConfigModule valida o env quando o AppModule é importado, então o import vem depois do env
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue(alwaysUp)
      .overrideProvider(RedisHealthIndicator)
      .useValue(alwaysUp)
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    // se o teste falhar antes do close, as conexões ficariam abertas; chamar de novo não faz nada
    await app?.close();
    if (previous === undefined) delete process.env.SHUTDOWN_GRACE_MS;
    else process.env.SHUTDOWN_GRACE_MS = previous;
  });

  it('depois do SIGTERM, ready responde 503 durante o atraso e a app segue atendendo', async () => {
    const server = app.getHttpServer();
    await request(server).get('/health/ready').expect(200);

    // o mesmo caminho do enableShutdownHooks ao receber o sinal, sem matar o processo do teste. A
    // interface do INestApplication omite o `signal`, que a implementação aceita
    const close: (signal?: string) => Promise<void> = app.close.bind(app);
    const started = Date.now();
    const closing = close('SIGTERM');

    const ready = await request(server).get('/health/ready').expect(503);
    expect(ready.headers['content-type']).toMatch(/^application\/json/);
    expect(ready.body).toMatchObject({ status: 'shutting_down' });
    // o liveness não cai: o processo está vivo e terminando o que tem em andamento
    await request(server).get('/health/live').expect(200);

    await closing;
    expect(Date.now() - started).toBeGreaterThanOrEqual(GRACE_MS);
  });
});
