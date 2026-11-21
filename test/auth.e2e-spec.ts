import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();
  const uniqueEmail = () => `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());

  it('cadastra e faz login, devolvendo um JWT assinado com sub e roles', async () => {
    const email = uniqueEmail();
    const reg = await request(server())
      .post('/v1/auth/register')
      .send({ name: 'Ana', email, password: 'secret-123' })
      .expect(201);

    const login = await request(server())
      .post('/v1/auth/login')
      .send({ email: email.toUpperCase(), password: 'secret-123' })
      .expect(200);

    const claims = await app.get(JwtService).verifyAsync(login.body.accessToken);
    expect(claims.sub).toBe(reg.body.id);
    expect(claims.roles).toEqual([]);
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it('não devolve a senha nem o hash em nenhuma resposta', async () => {
    const res = await request(server())
      .post('/v1/auth/register')
      .send({ name: 'Ana', email: uniqueEmail(), password: 'secret-123' })
      .expect(201);
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  it('rejeita e-mail repetido com 409', async () => {
    const email = uniqueEmail();
    await request(server()).post('/v1/auth/register').send({ name: 'Ana', email, password: 'secret-123' }).expect(201);
    const res = await request(server())
      .post('/v1/auth/register')
      .send({ name: 'Ana', email, password: 'secret-123' })
      .expect(409);
    expect(res.body.code).toBe('EMAIL_ALREADY_IN_USE');
  });

  it('rejeita senha errada e e-mail desconhecido com a mesma resposta (401)', async () => {
    const email = uniqueEmail();
    await request(server()).post('/v1/auth/register').send({ name: 'Ana', email, password: 'secret-123' }).expect(201);

    const wrong = await request(server()).post('/v1/auth/login').send({ email, password: 'nope-nope' }).expect(401);
    const ghost = await request(server())
      .post('/v1/auth/login')
      .send({ email: uniqueEmail(), password: 'secret-123' })
      .expect(401);
    expect(wrong.body).toEqual(ghost.body);
  });

  it('exige o nome no cadastro (ausente, vazio ou longo demais)', async () => {
    const base = { email: uniqueEmail(), password: 'secret-123' };
    await request(server()).post('/v1/auth/register').send(base).expect(400);
    await request(server()).post('/v1/auth/register').send({ ...base, name: '' }).expect(400);
    await request(server()).post('/v1/auth/register').send({ ...base, name: 'x'.repeat(101) }).expect(400);
  });

  it('valida o corpo (e-mail inválido, senha curta, campo extra)', async () => {
    await request(server()).post('/v1/auth/register').send({ name: 'Ana', email: 'x', password: 'secret-123' }).expect(400);
    await request(server()).post('/v1/auth/register').send({ name: 'Ana', email: uniqueEmail(), password: 'short' }).expect(400);
    await request(server())
      .post('/v1/auth/register')
      .send({ name: 'Ana', email: uniqueEmail(), password: 'secret-123', roles: ['admin'] })
      .expect(400);
  });
});
