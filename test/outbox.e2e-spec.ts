import './helpers/enable-outbox-worker';
import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { IntegrationEvent } from '../src/shared/application/integration-event';
import { registerAndLogin } from './helpers/auth';
import { seedProduct } from './helpers/catalog';

describe('Outbox worker (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('pagar um pedido entrega orders.order-paid ao handler e marca a linha como publicada', async () => {
    const received: IntegrationEvent[] = [];
    app.get(EventEmitter2).on('orders.order-paid', (e: IntegrationEvent) => received.push(e));

    const user = await registerAndLogin(app);
    const productId = await seedProduct(app, 700, 5);
    const server = app.getHttpServer();
    const created = await request(server)
      .post('/v1/orders')
      .set(user.auth)
      .send({ items: [{ productId, qty: 1 }] })
      .expect(201);
    const id = created.body.id as string;
    await request(server).post(`/v1/orders/${id}/place`).set(user.auth).expect(204);
    await request(server).post(`/v1/orders/${id}/pay`).set(user.auth).expect(204);

    await waitFor(() => received.some((e) => e.payload.orderId === id));

    const event = received.find((e) => e.payload.orderId === id)!;
    expect(event).toMatchObject({ type: 'orders.order-paid', version: 1 });
    const [row] = await app
      .get(DataSource)
      .query(`SELECT "publishedAt" FROM shared.outbox WHERE id = $1`, [event.eventId]);
    expect(row.publishedAt).not.toBeNull();
  });
});

async function waitFor(condition: () => boolean, timeoutMs = 10_000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout esperando o evento');
    await new Promise((r) => setTimeout(r, 100));
  }
}
