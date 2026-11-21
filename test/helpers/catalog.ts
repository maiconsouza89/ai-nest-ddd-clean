import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { registerAndLogin } from './auth';

/** Insere um produto direto no banco do catalog e devolve o id. */
export async function seedProduct(app: INestApplication, priceCents = 1000, name = 'Produto') {
  const id = crypto.randomUUID();
  await app
    .get(DataSource)
    .query(`INSERT INTO catalog.products (id, name, "priceCents") VALUES ($1, $2, $3)`, [
      id,
      name,
      priceCents,
    ]);
  return id;
}

/** Cadastra um usuário admin e devolve o header Authorization (o papel vai no token, então loga de novo). */
export async function registerAdmin(app: INestApplication) {
  const user = await registerAndLogin(app);
  await app
    .get(DataSource)
    .query(`UPDATE identity.users SET roles = ARRAY['admin'] WHERE id = $1`, [user.id]);
  const login = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email: user.email, password: user.password })
    .expect(200);
  return { Authorization: `Bearer ${login.body.accessToken}` };
}
