import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// o código de verificação sai por evento: os workers ficam ligados
import './helpers/enable-outbox-worker.js';
import type { TestApp } from './helpers/test-app.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { deleteUser, registerAndLogin, setRoles, uniqueEmail } from './helpers/auth.js';
import { GuardProbeController } from './helpers/guard-probe.controller.js';
import { emailsTo, emailsWith, verificationCodeFor, waitForEmail } from './helpers/mailpit.js';

describe('Auth (e2e)', () => {
  let app: TestApp;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [GuardProbeController],
    }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());

  it('cadastra, recusa o login até verificar o e-mail, verifica e entra com um JWT só com o sub', async () => {
    const email = uniqueEmail();
    const password = 'secret-123';
    const reg = await request(server())
      .post('/v1/auth/register')
      .send({ name: 'Ana', email, password })
      .expect(201);

    const blocked = await request(server())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(403);
    expect(blocked.body.code).toBe('EMAIL_NOT_VERIFIED');

    const code = await verificationCodeFor(email);
    const wrongCode = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
    const wrong = await request(server())
      .post('/v1/auth/verify-email')
      .send({ email, code: wrongCode })
      .expect(400);
    expect(wrong.body.code).toBe('INVALID_VERIFICATION_CODE');

    await request(server()).post('/v1/auth/verify-email').send({ email, code }).expect(204);

    const login = await request(server())
      .post('/v1/auth/login')
      .send({ email: email.toUpperCase(), password })
      .expect(200);

    const claims = await app.get(JwtService).verifyAsync(login.body.accessToken);
    expect(claims.sub).toBe(reg.body.id);
    expect(claims).not.toHaveProperty('roles'); // as roles vêm do banco a cada requisição
    // lido da configuração: um JWT_ACCESS_TTL_SECONDS no .env não quebra o teste (o padrão, 900,
    // é coberto pelo spec do validateEnv)
    const ttl = app.get(ConfigService).getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');
    expect(claims.exp - claims.iat).toBe(ttl);
    expect(login.body.expiresIn).toBe(ttl);

    const welcome = await waitForEmail(email, 'Boas-vindas, Ana');
    expect(welcome.text).toContain('Seu e-mail foi verificado');
  });

  describe('verificação do e-mail', () => {
    const post = (path: string, body: object) =>
      request(server()).post(`/v1/auth/${path}`).send(body);

    it('o código vale uma vez só', async () => {
      const email = uniqueEmail();
      await post('register', { name: 'Ana', email, password: 'secret-123' }).expect(201);
      const code = await verificationCodeFor(email);

      await post('verify-email', { email, code }).expect(204);
      const again = await post('verify-email', { email, code }).expect(400);
      expect(again.body.code).toBe('INVALID_VERIFICATION_CODE');
    });

    it('e-mail desconhecido dá o mesmo erro que código errado', async () => {
      const res = await post('verify-email', { email: uniqueEmail(), code: '123456' }).expect(400);
      expect(res.body.code).toBe('INVALID_VERIFICATION_CODE');
    });

    it('valida o formato do código', async () => {
      const email = uniqueEmail();
      for (const code of ['12345', '1234567', 'abcdef', 123456]) {
        await post('verify-email', { email, code }).expect(400);
      }
    });

    it('o reenvio responde 202 para e-mail desconhecido, sem enviar nada', async () => {
      const email = uniqueEmail();
      await post('resend-verification-code', { email }).expect(202);
      expect(await emailsTo(email)).toEqual([]);
    });

    it('o reenvio antes de 60 segundos responde 202 e não envia outro código', async () => {
      const email = uniqueEmail();
      await post('register', { name: 'Ana', email, password: 'secret-123' }).expect(201);
      const code = await verificationCodeFor(email);

      await post('resend-verification-code', { email }).expect(202);

      // o primeiro código continua valendo: um reenvio aceito o teria invalidado
      await post('verify-email', { email, code }).expect(204);
      // as boas-vindas saem depois de tudo o que veio antes delas na outbox do usuário
      await waitForEmail(email, 'Boas-vindas, Ana');
      expect(await emailsWith(email, 'Seu código de verificação')).toHaveLength(1);
    });
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
    const { email } = await registerAndLogin(app);

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

  it('não conta os espaços das pontas do nome e grava o nome sem eles', async () => {
    const name = 'x'.repeat(100);
    const reg = await request(server())
      .post('/v1/auth/register')
      .send({ name: `  ${name}  `, email: uniqueEmail(), password: 'secret-123' })
      .expect(201);
    const [row] = await app
      .get(DataSource)
      .query(`SELECT name FROM identity.users WHERE id = $1`, [reg.body.id]);
    expect(row.name).toBe(name);
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
      const req = request(server()).get('/v1/guard-probe');
      return token ? req.set('Authorization', `${scheme} ${token}`) : req;
    };

    it('aceita um token válido e carrega o ator pelo sub', async () => {
      const user = await registerAndLogin(app);
      const res = await call(user.token).expect(200);
      expect(res.body).toEqual({ id: user.id, roles: [] });
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
      const adminOnly = () => request(server()).post('/v1/guard-probe/admin').set(user.auth);

      await adminOnly().expect(403);
      await setRoles(app, user.id, ['admin']);
      await adminOnly().expect(204);
      await setRoles(app, user.id, []);
      await adminOnly().expect(403);
    });

    it('as rotas de auth continuam públicas', async () => {
      await request(server())
        .post('/v1/auth/login')
        .send({ email: uniqueEmail(), password: 'secret-123' })
        .expect(401); // credenciais inválidas, não "sem token"
    });
  });

  describe('refresh token e logout', () => {
    const post = (path: string, body: object) =>
      request(server()).post(`/v1/auth/${path}`).send(body);

    it('login → refresh → chamada autenticada → logout → refresh recusado', async () => {
      const user = await registerAndLogin(app);

      const renewed = await post('refresh', { refreshToken: user.refreshToken }).expect(200);
      expect(renewed.body).toEqual({
        accessToken: expect.any(String),
        expiresIn: expect.any(Number),
        refreshToken: expect.any(String),
      });
      expect(renewed.body.refreshToken).not.toBe(user.refreshToken);

      await request(server())
        .get('/v1/guard-probe')
        .set({ Authorization: `Bearer ${renewed.body.accessToken}` })
        .expect(200);

      await post('logout', { refreshToken: renewed.body.refreshToken }).expect(204);
      const after = await post('refresh', { refreshToken: renewed.body.refreshToken }).expect(401);
      expect(after.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('reusar um refresh token já trocado derruba a sessão inteira', async () => {
      const user = await registerAndLogin(app);
      const renewed = await post('refresh', { refreshToken: user.refreshToken }).expect(200);

      await post('refresh', { refreshToken: user.refreshToken }).expect(401);
      await post('refresh', { refreshToken: renewed.body.refreshToken }).expect(401);
    });

    it('logout responde 204 mesmo com token desconhecido', async () => {
      await post('logout', { refreshToken: 'desconhecido' }).expect(204);
    });

    it('valida o corpo', async () => {
      await post('refresh', {}).expect(400);
      await post('logout', { refreshToken: 'x'.repeat(129) }).expect(400);
    });

    it('conta apagada não renova mais', async () => {
      const user = await registerAndLogin(app);
      await deleteUser(app, user.id);
      await post('refresh', { refreshToken: user.refreshToken }).expect(401);
    });
  });
});
