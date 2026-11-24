import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import './helpers/enable-outbox-worker.js';
import type { TestApp } from './helpers/test-app.js';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { OnVerificationCodeIssuedHandler } from '#modules/notifications/infra/events/on-verification-code-issued.handler';
import { configureApp } from '../src/app.setup.js';
import { IntegrationEvent } from '#shared/application/integration-event';
import { registerUser } from './helpers/auth.js';
import { emailsWith, waitForEmail } from './helpers/mailpit.js';
import { waitFor } from './helpers/wait-for.js';

const EVENT = 'identity.verification-code-issued';
const CONSUMER = 'notifications.email-on-verification-code-issued';
const SUBJECT = 'Seu código de verificação';

describe('Outbox worker (e2e)', () => {
  let app: TestApp;
  const ds = () => app.get(DataSource);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const marksOf = async (eventId: string) =>
    ds().query(`SELECT 1 FROM shared.processed_events WHERE "eventId" = $1 AND consumer = $2`, [
      eventId,
      CONSUMER,
    ]);

  it('o register grava o evento, o relay publica, o worker do notifications envia o e-mail e a reentrega não repete o efeito', async () => {
    const { email, id: userId } = await registerUser(app);

    // o evento entra na outbox na transação do register: a linha existe quando a resposta chega
    const [event] = await ds().query(
      `SELECT id, type, version, payload, "occurredAt" FROM shared.outbox WHERE "aggregateId" = $1 AND type = $2`,
      [userId, EVENT],
    );
    expect(event).toMatchObject({ type: EVENT, version: 1 });

    // o relay marca a linha na transação do lote, que pode fechar depois que o worker já processou
    await waitForEmail(email, SUBJECT);
    await waitFor(async () => (await marksOf(event.id)).length === 1);
    await waitFor(async () => {
      const [row] = await ds().query(`SELECT "publishedAt" FROM shared.outbox WHERE id = $1`, [
        event.id,
      ]);
      return row.publishedAt !== null;
    });

    // a outbox já publicou uma vez; entregamos a mesma mensagem outra vez, como num retry
    const redelivered: IntegrationEvent = {
      eventId: event.id,
      type: event.type,
      version: event.version,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload,
    };
    await app.get(OnVerificationCodeIssuedHandler).handle(redelivered as never);

    // a garantia é a marca única; o e-mail único só vale porque o envio espera o aceite do SMTP
    expect(await marksOf(event.id)).toHaveLength(1);
    expect(await emailsWith(email, SUBJECT)).toHaveLength(1);
  });
});
