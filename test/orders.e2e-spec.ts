import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerAndLogin } from './helpers/auth';
import { seedProduct } from './helpers/catalog';

type Session = Awaited<ReturnType<typeof registerAndLogin>>;

describe('Orders (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();
  let productId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    productId = await seedProduct(app, 1000);
  });

  afterAll(() => app.close());

  async function createOrder(user: Session) {
    const res = await request(server())
      .post('/v1/orders')
      .set(user.auth)
      .send({ items: [{ productId, qty: 2 }] })
      .expect(201);
    return res.body.id as string;
  }

  it('usa o preço do catálogo e rejeita produto inexistente (404)', async () => {
    const user = await registerAndLogin(app);
    await createOrder(user);
    const list = await request(server()).get('/v1/orders').set(user.auth).expect(200);
    expect(list.body.items[0]).toMatchObject({ itemCount: 1, totalCents: 2000 });

    const res = await request(server())
      .post('/v1/orders')
      .set(user.auth)
      .send({ items: [{ productId: crypto.randomUUID(), qty: 1 }] })
      .expect(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('rejeita requisição sem token', () =>
    request(server()).post('/v1/orders').send({ items: [] }).expect(401));

  it('rejeita corpo com campo extra', async () => {
    const user = await registerAndLogin(app);
    await request(server())
      .post('/v1/orders')
      .set(user.auth)
      .send({ items: [{ productId, qty: 1 }], extra: true })
      .expect(400);
  });

  it('cria, fecha e paga; pagar de novo devolve 409', async () => {
    const user = await registerAndLogin(app);
    const id = await createOrder(user);
    await request(server()).post(`/v1/orders/${id}/place`).set(user.auth).expect(204);
    await request(server()).post(`/v1/orders/${id}/pay`).set(user.auth).expect(204);

    const again = await request(server()).post(`/v1/orders/${id}/pay`).set(user.auth).expect(409);
    expect(again.body.code).toBe('ORDER_ALREADY_PAID');
  });

  it('o pedido pertence ao usuário do token, não a um id enviado pelo cliente', async () => {
    const user = await registerAndLogin(app);
    const id = await createOrder(user);

    const list = await request(server()).get('/v1/orders').set(user.auth).expect(200);
    expect(list.body.items.map((i: { id: string }) => i.id)).toContain(id);
  });

  it('outro usuário não paga o pedido (403)', async () => {
    const owner = await registerAndLogin(app);
    const other = await registerAndLogin(app);
    const id = await createOrder(owner);
    await request(server()).post(`/v1/orders/${id}/place`).set(owner.auth).expect(204);

    const res = await request(server()).post(`/v1/orders/${id}/pay`).set(other.auth).expect(403);
    expect(res.body.code).toBe('NOT_ORDER_OWNER');
  });

  describe('GET /v1/orders', () => {
    it('lista só os pedidos do usuário autenticado', async () => {
      const me = await registerAndLogin(app);
      const someoneElse = await registerAndLogin(app);
      const mine = await createOrder(me);
      await createOrder(someoneElse);

      const res = await request(server()).get('/v1/orders').set(me.auth).expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([mine]);
      expect(res.body).toMatchObject({ page: 1, limit: 20 });
    });

    it('rejeita limit acima de 100', async () => {
      const user = await registerAndLogin(app);
      await request(server()).get('/v1/orders?limit=500').set(user.auth).expect(400);
    });

    it('exige token', () => request(server()).get('/v1/orders').expect(401));
  });
});
