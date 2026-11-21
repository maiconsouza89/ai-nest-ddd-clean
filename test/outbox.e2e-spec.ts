import './helpers/enable-outbox-worker';
import type { TestApp } from './helpers/test-app';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { OnOrderCancelledHandler } from '../src/modules/inventory/infra/events/on-order-cancelled.handler';
import { Email, EmailSender } from '../src/modules/notifications/application/ports/email-sender';
import { configureApp } from '../src/app.setup';
import { IntegrationEvent } from '../src/shared/application/integration-event';
import { registerAndLogin } from './helpers/auth';
import { seedProduct } from './helpers/catalog';
import { waitFor } from './helpers/wait-for';

jest.setTimeout(20_000); // o evento passa pelo relay (poll de 1s) e pela fila antes do efeito

describe('Outbox worker (e2e)', () => {
  let app: TestApp;
  const sentEmails: Email[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailSender)
      .useValue({ send: async (email: Email) => void sentEmails.push(email) })
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('pagar um pedido enfileira orders.order-paid, o worker do notifications processa e a linha fica publicada', async () => {
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

    const ds = app.get(DataSource);
    const outboxRow = async () =>
      (
        await ds.query(
          `SELECT id, type, version, "publishedAt" FROM shared.outbox WHERE "aggregateId" = $1 AND type = 'orders.order-paid'`,
          [id],
        )
      )[0];
    await waitFor(async () => (await outboxRow()) !== undefined);
    const event = await outboxRow();
    expect(event).toMatchObject({ type: 'orders.order-paid', version: 1 });
    // o relay marca a linha quando o evento entra nas filas; o efeito vem depois, pelo worker
    const isPublished = async () => {
      const [row] = await ds.query(`SELECT "publishedAt" FROM shared.outbox WHERE id = $1`, [
        event.id,
      ]);
      return row.publishedAt !== null;
    };
    await waitFor(isPublished);
    const isProcessed = async () =>
      (
        await ds.query(
          `SELECT 1 FROM shared.processed_events WHERE "eventId" = $1 AND consumer = 'notifications.email-on-order-paid'`,
          [event.id],
        )
      ).length === 1;
    await waitFor(isProcessed);
  });

  it('pagar um pedido envia o e-mail de confirmação ao cliente', async () => {
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

    await waitFor(() => sentEmails.some((e) => e.to === user.email));

    expect(sentEmails.filter((e) => e.to === user.email)).toHaveLength(1);
  });

  describe('cancelar um pedido', () => {
    const server = () => app.getHttpServer();
    const ds = () => app.get(DataSource);
    const stockOf = async (id: string) =>
      (
        await ds().query(`SELECT available FROM inventory.stock_items WHERE "productId" = $1`, [id])
      )[0].available as number;

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
      await app.get(OnOrderCancelledHandler).handle(redelivered as never);

      expect(await stockOf(productId)).toBe(10);
      const marks = await ds().query(`SELECT 1 FROM shared.processed_events WHERE "eventId" = $1`, [
        event.id,
      ]);
      expect(marks).toHaveLength(1);
    });

    it('cancelar pedido pago devolve 409 e não mexe no estoque', async () => {
      const { user, productId, id } = await placedOrder(2);
      await request(server()).post(`/v1/orders/${id}/pay`).set(user.auth).expect(204);

      const res = await request(server())
        .post(`/v1/orders/${id}/cancel`)
        .set(user.auth)
        .expect(409);

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

      await waitFor(
        async () =>
          (
            await ds().query(
              `SELECT 1 FROM shared.processed_events WHERE consumer = 'inventory.release-on-order-cancelled' AND "eventId" IN (SELECT id FROM shared.outbox WHERE "aggregateId" = $1)`,
              [created.body.id],
            )
          ).length === 1,
      );

      expect(await stockOf(productId)).toBe(10);
    });
  });
});
