import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import 'reflect-metadata';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { metrics } from '@opentelemetry/api';
import { DataSource } from 'typeorm';
import { FakeLogger } from '#test/fakes/fake-logger';
import { startTestMetrics } from '#test/helpers/metrics';
import { startOutboxDatabase } from '#test/helpers/outbox-database';
import { Logger } from '../../application/ports/logger.js';
import { OutboxMetrics } from './outbox-metrics.js';

describe('OutboxMetrics (integração)', () => {
  let ds: DataSource;
  let stop: () => Promise<void>;
  let collectPoints: ReturnType<typeof startTestMetrics>;
  let app: TestingModule | undefined;

  beforeAll(async () => {
    ({ ds, stop } = await startOutboxDatabase());
  });

  afterAll(() => stop?.());

  // um provider por teste: o reader guarda o último valor de cada série
  beforeEach(async () => {
    collectPoints = startTestMetrics();
    await ds.query(`DELETE FROM shared.outbox`);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    metrics.disable();
    vi.restoreAllMocks();
  });

  async function startApp(workerEnabled = 'true') {
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ OUTBOX_WORKER_ENABLED: workerEnabled })],
        }),
      ],
      providers: [
        OutboxMetrics,
        { provide: DataSource, useValue: ds },
        { provide: Logger, useValue: new FakeLogger() },
      ],
    }).compile();
    await app.init();
  }

  async function insert(state: 'pending' | 'dead', createdAgo = '0 seconds') {
    await ds.query(
      `INSERT INTO shared.outbox (id, "aggregateId", type, version, payload, "occurredAt", "createdAt", "deadAt")
       VALUES (gen_random_uuid(), 'a1', 'test.thing-happened', 1, '{}', now(), now() - $1::interval, $2)`,
      [createdAgo, state === 'dead' ? new Date() : null],
    );
  }

  const outbox = async () => {
    const events = await collectPoints('outbox.events');
    const [age] = await collectPoints('outbox.oldest_pending.age');
    const byState = (state: string) =>
      events.find((p) => p.attributes['outbox.event.state'] === state)?.value;
    return { pending: byState('pending'), dead: byState('dead'), age: age?.value };
  };

  it('sem linhas, pendentes, mortos e idade em 0', async () => {
    await startApp();
    expect(await outbox()).toEqual({ pending: 0, dead: 0, age: 0 });
  });

  it('com um pendente gravado há 2 minutos, a idade é a dele', async () => {
    await insert('pending', '2 minutes');
    await startApp();

    const { pending, dead, age } = await outbox();

    expect(pending).toBe(1);
    expect(dead).toBe(0);
    expect(age).toBeGreaterThanOrEqual(120);
    expect(age).toBeLessThan(130);
  });

  it('um evento morto conta como morto, e não como pendente', async () => {
    await insert('dead', '2 minutes');
    await startApp();

    expect(await outbox()).toEqual({ pending: 0, dead: 1, age: 0 });
  });

  it('sem o worker da outbox, a instância não coleta', async () => {
    const query = vi.spyOn(ds, 'query');
    await startApp('false');

    expect(await collectPoints('outbox.events')).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('depois do app.close(), a coleta não consulta mais o banco', async () => {
    await startApp();
    await app!.close();
    app = undefined;
    const query = vi.spyOn(ds, 'query');

    await collectPoints('outbox.events');

    expect(query).not.toHaveBeenCalled();
  });
});
