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

  describe('cancelar um pedido', () => {
    const server = () => app.getHttpServer();
    const ds = () => app.get(DataSource);
    const stockOf = async (id: string) =>
      (await ds().query(`SELECT available FROM inventory.stock_items WHERE "productId" = $1`, [id]))[0]
        .available as number;

    async function placedOrder(qty: number) {
      const user = await registerAndLogin(app);
      const productId = await seedProduct(app, 700, 10);
      const created = await request(server())
        .post('/v1/orders')
        .set(user.auth)
        .send({ items: [{ productId, qty }] })
        .expect(201);
      const id = created.body.id as string;
      await request(server()).post(`/v1/orders/${id}/place`).set(user.auth).expect(204);
      return { user, productId, id };
    }

    it('devolve o estoque pelo evento, e entregar o mesmo evento de novo não repete o efeito', async () => {
      const { user, productId, id } = await placedOrder(4);
      expect(await stockOf(productId)).toBe(6);

      await request(server()).post(`/v1/orders/${id}/cancel`).set(user.auth).expect(204);

      await waitFor(async () => (await stockOf(productId)) === 10);
      const [event] = await ds().query(
        `SELECT id, type, version, payload, "occurredAt" FROM shared.outbox WHERE "aggregateId" = $1 AND type = 'orders.order-cancelled'`,
        [id],
      );
      // a outbox já publicou uma vez; entregamos a mesma mensagem outra vez, como num retry
      const redelivered: IntegrationEvent = {
        eventId: event.id,
        type: event.type,
        version: event.version,
        occurredAt: event.occurredAt.toISOString(),
        payload: event.payload,
      };
      await app.get(EventEmitter2).emitAsync(redelivered.type, redelivered);

      expect(await stockOf(productId)).toBe(10);
      const marks = await ds().query(
        `SELECT 1 FROM shared.processed_events WHERE "eventId" = $1`,
        [event.id],
      );
      expect(marks).toHaveLength(1);
    });

    it('cancelar pedido pago devolve 409 e não mexe no estoque', async () => {
      const { user, productId, id } = await placedOrder(2);
      await request(server()).post(`/v1/orders/${id}/pay`).set(user.auth).expect(204);

      const res = await request(server()).post(`/v1/orders/${id}/cancel`).set(user.auth).expect(409);

      expect(res.body.code).toBe('ORDER_NOT_CANCELLABLE');
      expect(await stockOf(productId)).toBe(8);
    });

    it('cancelar um rascunho não mexe no estoque', async () => {
      const user = await registerAndLogin(app);
      const productId = await seedProduct(app, 700, 10);
      const created = await request(server())
        .post('/v1/orders')
        .set(user.auth)
        .send({ items: [{ productId, qty: 3 }] })
        .expect(201);

      await request(server())
        .post(`/v1/orders/${created.body.id}/cancel`)
        .set(user.auth)
        .expect(204);
      await waitFor(async () => {
        const [row] = await ds().query(
          `SELECT "publishedAt" FROM shared.outbox WHERE "aggregateId" = $1`,
          [created.body.id],
        );
        return row?.publishedAt != null;
      });

      expect(await stockOf(productId)).toBe(10);
    });
  });
});

async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 10_000) {
  const start = Date.now();
  while (!(await condition())) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout esperando o evento');
    await new Promise((r) => setTimeout(r, 100));
  }
}
