import type { TestApp } from './test-app';
import request from 'supertest';

export const uniqueEmail = () =>
  `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

/** Cadastra um usuário novo, faz login e devolve o id e o header Authorization pronto. */
export async function registerAndLogin(app: TestApp) {
  const email = uniqueEmail();
  const password = 'secret-123';
  const reg = await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({ name: 'Test User', email, password })
    .expect(201);
  const login = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return {
    email,
    password,
    id: reg.body.id as string,
    token: login.body.accessToken as string,
    auth: { Authorization: `Bearer ${login.body.accessToken}` },
  };
}
