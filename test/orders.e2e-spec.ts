import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();
  const as = (userId: string) => ({ 'x-user-id': userId });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());

  async function createOrder(userId = 'u1') {
    const res = await request(server())
      .post('/v1/orders')
      .set(as(userId))
      .send({ items: [{ productId: 'p1', qty: 2 }] })
      .expect(201);
    return res.body.id as string;
  }

  it('rejeita requisição sem usuário', () =>
    request(server()).post('/v1/orders').send({ items: [] }).expect(401));

  it('rejeita corpo com campo extra', () =>
    request(server())
      .post('/v1/orders')
      .set(as('u1'))
      .send({ items: [{ productId: 'p1', qty: 1 }], extra: true })
      .expect(400));

  it('cria, fecha e paga; pagar de novo devolve 409', async () => {
    const id = await createOrder();
    await request(server()).post(`/v1/orders/${id}/place`).set(as('u1')).expect(204);
    await request(server()).post(`/v1/orders/${id}/pay`).set(as('u1')).expect(204);

    const again = await request(server()).post(`/v1/orders/${id}/pay`).set(as('u1')).expect(409);
    expect(again.body.code).toBe('ORDER_ALREADY_PAID');
  });

  it('outro usuário não paga o pedido (403)', async () => {
    const id = await createOrder('u1');
    await request(server()).post(`/v1/orders/${id}/place`).set(as('u1')).expect(204);

    const res = await request(server()).post(`/v1/orders/${id}/pay`).set(as('u2')).expect(403);
    expect(res.body.code).toBe('NOT_ORDER_OWNER');
  });

  describe('GET /v1/orders', () => {
    it('lista só os pedidos do usuário autenticado', async () => {
      const user = `lister-${Date.now()}`;
      const mine = await createOrder(user);
      await createOrder(`other-${Date.now()}`);

      const res = await request(server()).get('/v1/orders').set(as(user)).expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([mine]);
      expect(res.body).toMatchObject({ page: 1, limit: 20 });
    });

    it('rejeita limit acima de 100', () =>
      request(server()).get('/v1/orders?limit=500').set(as('u1')).expect(400));

    it('exige usuário', () => request(server()).get('/v1/orders').expect(401));
  });
});
