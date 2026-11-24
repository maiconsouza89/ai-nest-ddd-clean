import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// o e-mail do passo 11 sai por evento, como no tutorial: os workers ficam ligados
import './helpers/enable-outbox-worker.js';
import type { TestApp } from './helpers/test-app.js';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Email, EmailSender } from '#modules/notifications/application/ports/email-sender';
import { configureApp } from '../src/app.setup.js';
import { uniqueEmail } from './helpers/auth.js';
import { seedProduct } from './helpers/catalog.js';
import { waitFor } from './helpers/wait-for.js';

// Espelho de docs/tutorials/01-do-clone-ao-primeiro-pedido.md: os mesmos passos, na mesma ordem.
// Ao mudar um, mude o outro.
describe('Tutorial: do clone ao primeiro pedido (e2e)', () => {
  let app: TestApp;
  const server = () => app.getHttpServer();
  const sentEmails: Email[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailSender)
      .useValue({ send: async (email: Email) => void sentEmails.push(email) })
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());

  it('cadastra, entra, cria, fecha e paga um pedido', async () => {
    // O tutorial usa o mouse do seed do catalog. Este produto é do teste, para o estoque do seed
    // não acabar depois de muitas execuções; o nome o separa do seed na listagem.
    const productId = await seedProduct(app, 14900, 10, 'Mouse sem fio (e2e)');
    const email = uniqueEmail();
    const password = 'minha-senha-123';

    // passo 5: cadastro
    const registered = await request(server())
      .post('/v1/auth/register')
      .send({ name: 'Ana', email, password })
      .expect(201);
    expect(registered.body).toEqual({ id: expect.any(String) });

    // passo 6: login
    const login = await request(server())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);
    expect(login.body).toEqual({
      accessToken: expect.any(String),
      // o tutorial diz 15 minutos, o padrão; um JWT_ACCESS_TTL_SECONDS no .env não quebra o teste
      expiresIn: app.get(ConfigService).getOrThrow<number>('JWT_ACCESS_TTL_SECONDS'),
      refreshToken: expect.any(String),
    });
    const auth = { Authorization: `Bearer ${login.body.accessToken}` };

    // passo 7: a listagem de produtos e o produto escolhido
    const products = await request(server()).get('/v1/products').set(auth).expect(200);
    expect(products.body).toMatchObject({ items: expect.any(Array), page: 1, limit: 20 });
    const product = await request(server()).get(`/v1/products/${productId}`).set(auth).expect(200);
    expect(product.body).toMatchObject({ priceCents: 14900, currency: 'BRL' });

    // passo 8: criar o pedido; o preço vem do catálogo
    const created = await request(server())
      .post('/v1/orders')
      .set(auth)
      .send({ items: [{ productId, qty: 2 }] })
      .expect(201);
    const orderId = created.body.id as string;

    const list = await request(server()).get('/v1/orders').set(auth).expect(200);
    expect(list.body.items).toEqual([
      expect.objectContaining({
        id: orderId,
        status: 'DRAFT',
        itemCount: 1,
        totalCents: 29800,
        currency: 'BRL',
      }),
    ]);
    const statusNow = async () =>
      (await request(server()).get(`/v1/orders/${orderId}`).set(auth).expect(200)).body.status;

    // passo 9: fechar; a consulta do pedido mostra o estado novo na hora
    await request(server()).post(`/v1/orders/${orderId}/place`).set(auth).expect(204);
    const placed = await request(server()).get(`/v1/orders/${orderId}`).set(auth).expect(200);
    expect(placed.body).toMatchObject({ status: 'PLACED', totalCents: 29800 });

    // passo 10: pagar, e repetir com a mesma chave não cobra de novo
    const pay = () =>
      request(server())
        .post(`/v1/orders/${orderId}/pay`)
        .set(auth)
        .set('Idempotency-Key', 'pagamento-1')
        .expect(204);
    await pay();
    expect(await statusNow()).toBe('PAID');
    await pay();

    // passo 11: o e-mail de confirmação. O pagamento repetido não gera outro evento, então não há
    // segundo e-mail; a entrega duplicada do mesmo evento é do idempotent-consumer.int-spec.
    const paidEvents = await app
      .get(DataSource)
      .query(
        `SELECT id FROM shared.outbox WHERE type = 'orders.order-paid' AND payload->>'orderId' = $1`,
        [orderId],
      );
    expect(paidEvents).toHaveLength(1);
    const emailsOfOrder = () => sentEmails.filter((e) => e.subject.includes(orderId));
    await waitFor(() => emailsOfOrder().length > 0);
    expect(emailsOfOrder()).toEqual([
      expect.objectContaining({ subject: `Pagamento confirmado: pedido ${orderId}` }),
    ]);
  });
});
