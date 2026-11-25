import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestApp } from './helpers/test-app.js';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { provideErrorStatuses } from '#shared/infra/http/error-status.registry';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ERROR_PROBE_STATUSES, ErrorProbeController } from './helpers/error-probe.controller.js';
import { expectProblemJson } from './helpers/problem.js';

describe('Problem Details (e2e)', () => {
  let app: TestApp;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ErrorProbeController],
      providers: [provideErrorStatuses(ERROR_PROBE_STATUSES)],
    }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());

  it('erro de domínio: o status registrado e o code, sem a query string no instance', async () => {
    const res = await request(server()).get('/v1/error-probe/domain?trace=1').expect(418);

    expectProblemJson(res);
    expect(res.body).toEqual({
      type: 'about:blank',
      title: "I'm a Teapot",
      status: 418,
      detail: 'The probe is a teapot',
      instance: '/v1/error-probe/domain',
      code: 'PROBE_TEAPOT',
    });
  });

  it('erro de domínio com código fora do mapa: 422', async () => {
    const res = await request(server()).get('/v1/error-probe/unmapped').expect(422);

    expectProblemJson(res);
    expect(res.body).toMatchObject({
      type: 'about:blank',
      title: 'Unprocessable Entity',
      status: 422,
      code: 'PROBE_UNMAPPED',
      instance: '/v1/error-probe/unmapped',
    });
  });

  it('validação: 400 com o pointer do campo aninhado e do campo proibido', async () => {
    const res = await request(server())
      .post('/v1/error-probe/validate')
      .send({ items: [{ name: 'a', quantity: 0 }], extra: true })
      .expect(400);

    expectProblemJson(res);
    expect(res.body).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code: 'VALIDATION_FAILED',
      instance: '/v1/error-probe/validate',
    });
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { pointer: '#/items/0/quantity', detail: 'quantity must not be less than 1' },
        { pointer: '#/extra', detail: 'property extra should not exist' },
      ]),
    );
  });

  it('erro inesperado: 500 com o detail genérico, sem a mensagem interna', async () => {
    const res = await request(server()).get('/v1/error-probe/unexpected').expect(500);

    expectProblemJson(res);
    expect(res.body).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
      instance: '/v1/error-probe/unexpected',
      code: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it('rota inexistente: 404 NOT_FOUND', async () => {
    const res = await request(server()).get('/v1/error-probe/nope').expect(404);

    expectProblemJson(res);
    expect(res.body).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});
