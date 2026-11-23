import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestApp } from './helpers/test-app.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { deleteUser, registerAndLogin, setRoles, uniqueEmail } from './helpers/auth.js';

describe('Auth (e2e)', () => {
  let app: TestApp;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());

  it('cadastra e faz login, devolvendo um JWT assinado só com o sub', async () => {
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
    expect(claims).not.toHaveProperty('roles'); // as roles vêm do banco a cada requisição
    // lido da configuração: um JWT_ACCESS_TTL_SECONDS no .env não quebra o teste (o padrão, 900,
    // é coberto pelo spec do validateEnv)
    const ttl = app.get(ConfigService).getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');
    expect(claims.exp - claims.iat).toBe(ttl);
    expect(login.body.expiresIn).toBe(ttl);
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
    await request(server())
      .post('/v1/auth/register')
      .send({ name: 'Ana', email, password: 'secret-123' })
      .expect(201);
    const res = await request(server())
      .post('/v1/auth/register')
      .send({ name: 'Ana', email, password: 'secret-123' })
      .expect(409);
    expect(res.body.code).toBe('EMAIL_ALREADY_IN_USE');
  });

  it('rejeita senha errada e e-mail desconhecido com a mesma resposta (401)', async () => {
    const email = uniqueEmail();
    await request(server())
      .post('/v1/auth/register')
      .send({ name: 'Ana', email, password: 'secret-123' })
      .expect(201);

    const wrong = await request(server())
      .post('/v1/auth/login')
      .send({ email, password: 'nope-nope' })
      .expect(401);
    const ghost = await request(server())
      .post('/v1/auth/login')
      .send({ email: uniqueEmail(), password: 'secret-123' })
      .expect(401);
    expect(wrong.body).toEqual(ghost.body);
  });

  it('exige o nome no cadastro (ausente, vazio ou longo demais)', async () => {
    const base = { email: uniqueEmail(), password: 'secret-123' };
    await request(server()).post('/v1/auth/register').send(base).expect(400);
    await request(server())
      .post('/v1/auth/register')
      .send({ ...base, name: '' })
      .expect(400);
    await request(server())
      .post('/v1/auth/register')
      .send({ ...base, name: 'x'.repeat(101) })
      .expect(400);
  });

  it('valida o corpo (e-mail inválido, senha curta, campo extra)', async () => {
    await request(server())
      .post('/v1/auth/register')
      .send({ name: 'Ana', email: 'x', password: 'secret-123' })
      .expect(400);
    await request(server())
      .post('/v1/auth/register')
      .send({ name: 'Ana', email: uniqueEmail(), password: 'short' })
      .expect(400);
    await request(server())
      .post('/v1/auth/register')
      .send({ name: 'Ana', email: uniqueEmail(), password: 'secret-123', roles: ['admin'] })
      .expect(400);
  });

  describe('guard global', () => {
    const forge = (secret: string, payload: Record<string, unknown>, options = {}) =>
      new JwtService({ secret }).signAsync(payload, options);
    const secret = () => process.env.JWT_SECRET as string;
    const call = (token?: string, scheme = 'Bearer') => {
      const req = request(server()).get('/v1/orders');
      return token ? req.set('Authorization', `${scheme} ${token}`) : req;
    };

    it('aceita um token válido e usa o sub como dono', async () => {
      const user = await registerAndLogin(app);
      await call(user.token).expect(200);
    });

    it('rejeita sem header, com esquema errado e com lixo', async () => {
      await call().expect(401);
      const user = await registerAndLogin(app);
      await call(user.token, 'Basic').expect(401);
      await call('not.a.jwt').expect(401);
    });

    it('rejeita token assinado com outro segredo', async () => {
      const token = await forge('x'.repeat(40), { sub: 'u1' }, { expiresIn: 60 });
      await call(token).expect(401);
    });

    it('rejeita token expirado', async () => {
      const exp = Math.floor(Date.now() / 1000) - 60;
      const token = await forge(secret(), { sub: 'u1', roles: [], exp });
      await call(token).expect(401);
    });

    it('rejeita token assinado com outro algoritmo, mesmo com o segredo certo', async () => {
      const token = await forge(secret(), { sub: 'u1' }, { algorithm: 'HS512', expiresIn: 60 });
      await call(token).expect(401);
    });

    it('rejeita token válido sem sub ou com sub que não é texto', async () => {
      await call(await forge(secret(), {}, { expiresIn: 60 })).expect(401);
      await call(await forge(secret(), { sub: 42 }, { expiresIn: 60 })).expect(401);
    });

    it('rejeita o token de um usuário apagado depois do login', async () => {
      const user = await registerAndLogin(app);
      await call(user.token).expect(200);
      await deleteUser(app, user.id);
      await call(user.token).expect(401);
    });

    it('rejeita sub que nunca existiu, mesmo com assinatura válida', async () => {
      await call(await forge(secret(), { sub: crypto.randomUUID() }, { expiresIn: 60 })).expect(
        401,
      );
      await call(await forge(secret(), { sub: 'nao-e-uuid' }, { expiresIn: 60 })).expect(401);
    });

    it('aplica a mudança de role na requisição seguinte, com o mesmo token', async () => {
      const user = await registerAndLogin(app);
      const createProduct = () =>
        request(server()).post('/v1/products').set(user.auth).send({ name: 'X', priceCents: 100 });

      await setRoles(app, user.id, ['admin']);
      await createProduct().expect(201);
      await setRoles(app, user.id, []);
      await createProduct().expect(403);
    });

    it('as rotas de auth continuam públicas', async () => {
      await request(server())
        .post('/v1/auth/login')
        .send({ email: uniqueEmail(), password: 'secret-123' })
        .expect(401); // credenciais inválidas, não "sem token"
    });
  });
});
