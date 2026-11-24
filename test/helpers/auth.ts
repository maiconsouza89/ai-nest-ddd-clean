import type { TestApp } from './test-app.js';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { verificationCodeFor } from './mailpit.js';

export const uniqueEmail = () =>
  `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

const PASSWORD = 'secret-123';

/** Cadastra um usuário novo, sem verificar o e-mail, e devolve o id e o e-mail. */
export async function registerUser(app: TestApp) {
  const email = uniqueEmail();
  const reg = await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({ name: 'Test User', email, password: PASSWORD })
    .expect(201);
  return { email, id: reg.body.id as string };
}

/**
 * Cadastra um usuário novo, verifica o e-mail com o código que chega ao Mailpit, faz login e devolve
 * o id e o header Authorization pronto. O código sai por evento: o arquivo de teste precisa importar
 * o `enable-outbox-worker` antes do `AppModule`.
 */
export async function registerAndLogin(app: TestApp) {
  const { email, id } = await registerUser(app);
  await request(app.getHttpServer())
    .post('/v1/auth/verify-email')
    .send({ email, code: await verificationCodeFor(email) })
    .expect(204);
  const login = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return {
    email,
    id,
    token: login.body.accessToken as string,
    refreshToken: login.body.refreshToken as string,
    auth: { Authorization: `Bearer ${login.body.accessToken}` },
  };
}

/** Troca as roles do usuário direto no banco, como faria um admin numa ferramenta interna. */
export async function setRoles(app: TestApp, userId: string, roles: string[]) {
  await app
    .get(DataSource)
    .query(`UPDATE identity.users SET roles = $2 WHERE id = $1`, [userId, roles]);
}

export async function deleteUser(app: TestApp, userId: string) {
  await app.get(DataSource).query(`DELETE FROM identity.users WHERE id = $1`, [userId]);
}
