import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// o registerAndLogin verifica o e-mail com o código que sai por evento: os workers ficam ligados
import './helpers/enable-outbox-worker.js';
import type { TestApp } from './helpers/test-app.js';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { registerAndLogin } from './helpers/auth.js';
import { registerAdmin, seedProduct } from './helpers/catalog.js';
import { expectProblemJson } from './helpers/problem.js';

describe('Catalog (e2e)', () => {
  let app: TestApp;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());

  it('exige token', () => request(server()).get('/v1/products').expect(401));

  it('usuário comum não cria produto (403)', async () => {
    const user = await registerAndLogin(app);
    await request(server())
      .post('/v1/products')
      .set(user.auth)
      .send({ name: 'X', priceCents: 100 })
      .expect(403);
  });

  it('admin cria e atualiza; qualquer usuário lê', async () => {
    const admin = await registerAdmin(app);
    const created = await request(server())
      .post('/v1/products')
      .set(admin)
      .send({ name: '  Caneta  ', priceCents: 350 })
      .expect(201);
    expect(created.body).toMatchObject({ name: 'Caneta', priceCents: 350, currency: 'BRL' });

    await request(server())
      .patch(`/v1/products/${created.body.id}`)
      .set(admin)
      .send({ priceCents: 400 })
      .expect(200);

    const user = await registerAndLogin(app);
    const got = await request(server())
      .get(`/v1/products/${created.body.id}`)
      .set(user.auth)
      .expect(200);
    expect(got.body.priceCents).toBe(400);

    const list = await request(server()).get('/v1/products?limit=100').set(user.auth).expect(200);
    expect(list.body.items.map((p: { id: string }) => p.id)).toContain(created.body.id);
  });

  it('valida o corpo e o id', async () => {
    const admin = await registerAdmin(app);
    await request(server())
      .post('/v1/products')
      .set(admin)
      .send({ name: 'X', priceCents: -1 })
      .expect(400);
    await request(server())
      .post('/v1/products')
      .set(admin)
      .send({ name: '   ', priceCents: 100 })
      .expect(400);
    await request(server()).get('/v1/products/nao-e-uuid').set(admin).expect(400);
    const notFound = await request(server())
      .get(`/v1/products/${crypto.randomUUID()}`)
      .set(admin)
      .expect(404);
    expectProblemJson(notFound);
    expect(notFound.body).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      detail: 'Product not found',
    });
  });

  it('rejeita nome só de espaços e campos nulos na atualização (400)', async () => {
    const admin = await registerAdmin(app);
    const productId = await seedProduct(app, 100);
    await request(server())
      .patch(`/v1/products/${productId}`)
      .set(admin)
      .send({ name: '   ' })
      .expect(400);
    for (const body of [{ name: null }, { priceCents: null }]) {
      await request(server()).patch(`/v1/products/${productId}`).set(admin).send(body).expect(400);
    }
  });
});
