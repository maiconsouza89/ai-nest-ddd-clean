import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { FakeLogger } from '#test/fakes/fake-logger';
import { DomainError } from '../../domain/domain-error.js';
import { ErrorStatusRegistry } from './error-status.registry.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';
import { PROBLEM_JSON, type ProblemDetailsResponse } from './problem-details.response.js';

class OrderNotFoundError extends DomainError {
  readonly code = 'ORDER_NOT_FOUND';
}
class PaymentUnavailableError extends DomainError {
  readonly code = 'PAYMENT_UNAVAILABLE';
}
class UnmappedError extends DomainError {
  readonly code = 'SOMETHING_ODD';
}

class ItemRequest {
  @IsString() productId!: string;
  @IsInt() @Min(1) quantity!: number;
}
class OrderRequest {
  @ValidateNested({ each: true })
  @Type(() => ItemRequest)
  items!: ItemRequest[];
}

interface Reply {
  ended?: boolean;
  status?: number;
  body?: ProblemDetailsResponse;
  headers: Record<string, string>;
}

function fakeAdapterHost(reply: Reply) {
  const httpAdapter = {
    getRequestMethod: (req: { method: string }) => req.method,
    getRequestUrl: (req: { url: string }) => req.url,
    isHeadersSent: (res: { headersSent?: boolean }) => res.headersSent === true,
    end: () => {
      reply.ended = true;
    },
    setHeader: (_res: unknown, name: string, value: string) => {
      reply.headers[name] = value;
    },
    reply: (_res: unknown, body: ProblemDetailsResponse, status: number) => {
      reply.body = body;
      reply.status = status;
    },
  };
  return { httpAdapter } as unknown as HttpAdapterHost;
}

function httpHost(
  url = '/v1/orders/1',
  method = 'GET',
  type = 'http',
  response: { headersSent?: boolean } = {},
): ArgumentsHost {
  return {
    getType: () => type,
    switchToHttp: () => ({ getRequest: () => ({ method, url }), getResponse: () => response }),
  } as unknown as ArgumentsHost;
}

async function validationException(body: unknown) {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    errorFormat: 'grouped',
  });
  try {
    await pipe.transform(body, { type: 'body', metatype: OrderRequest });
  } catch (error) {
    return error as BadRequestException;
  }
  throw new Error('o corpo devia ser inválido');
}

describe('ProblemDetailsFilter', () => {
  let reply: Reply;
  let logger: FakeLogger;
  let filter: ProblemDetailsFilter;

  beforeEach(() => {
    reply = { headers: {} };
    logger = new FakeLogger();
    const registry = new ErrorStatusRegistry();
    registry.register({ ORDER_NOT_FOUND: 404, PAYMENT_UNAVAILABLE: 503 });
    filter = new ProblemDetailsFilter(fakeAdapterHost(reply), registry, logger);
  });

  it('erro de domínio usa o status registrado e o code dele', () => {
    filter.catch(new OrderNotFoundError('Order not found'), httpHost());

    expect(reply.status).toBe(404);
    expect(reply.headers['Content-Type']).toBe(PROBLEM_JSON);
    expect(reply.body).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Order not found',
      instance: '/v1/orders/1',
      code: 'ORDER_NOT_FOUND',
    });
    expect(logger.entries).toEqual([]);
  });

  it('erro de domínio sem status registrado responde 422 e avisa no log', () => {
    filter.catch(new UnmappedError('odd'), httpHost());

    expect(reply.status).toBe(422);
    expect(reply.body).toMatchObject({ status: 422, code: 'SOMETHING_ODD', detail: 'odd' });
    expect(logger.entries).toEqual([
      expect.objectContaining({ level: 'warn', fields: { code: 'SOMETHING_ODD' } }),
    ]);
  });

  it('NotFoundException vira NOT_FOUND com a mensagem dela, sem log', () => {
    filter.catch(new NotFoundException('Product not found'), httpHost());

    expect(reply.body).toMatchObject({
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
      detail: 'Product not found',
    });
    expect(logger.entries).toEqual([]);
  });

  it('UnauthorizedException vira UNAUTHORIZED', () => {
    filter.catch(new UnauthorizedException(), httpHost());

    expect(reply.body).toMatchObject({
      title: 'Unauthorized',
      status: 401,
      code: 'UNAUTHORIZED',
      detail: 'Unauthorized',
    });
  });

  it('validação: um item por mensagem, com o pointer do campo aninhado e do campo proibido', async () => {
    const exception = await validationException({
      items: [{ productId: 'p1', quantity: 0 }],
      extra: true,
    });
    filter.catch(exception, httpHost('/v1/orders', 'POST'));

    expect(reply.status).toBe(400);
    expect(reply.body).toMatchObject({
      title: 'Bad Request',
      status: 400,
      code: 'VALIDATION_FAILED',
      instance: '/v1/orders',
    });
    expect(reply.body?.errors).toEqual(
      expect.arrayContaining([
        { pointer: '#/items/0/quantity', detail: 'quantity must not be less than 1' },
        { pointer: '#/extra', detail: 'property extra should not exist' },
      ]),
    );
    expect(reply.body?.errors).toHaveLength(2);
  });

  it('validação: escapa ~ e / no pointer e mantém o aviso de mensagens omitidas', () => {
    const exception = new BadRequestException({
      message: { 'a/b.c~d': ['bad'], '...': ['Further validation errors were omitted'] },
      error: 'Bad Request',
      statusCode: 400,
    });
    filter.catch(exception, httpHost());

    expect(reply.body?.errors).toEqual([
      { pointer: '#/a~1b/c~0d', detail: 'bad' },
      { detail: 'Further validation errors were omitted' },
    ]);
  });

  it('erro inesperado: 500 genérico, sem a mensagem interna, com log', () => {
    const error = new Error('connection refused at 10.0.0.5');
    filter.catch(error, httpHost('/v1/orders', 'POST'));

    expect(reply.status).toBe(500);
    expect(reply.body).toMatchObject({
      title: 'Internal Server Error',
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred.',
    });
    expect(JSON.stringify(reply.body)).not.toContain('10.0.0.5');
    expect(logger.entries).toEqual([
      expect.objectContaining({
        level: 'error',
        fields: { err: error, method: 'POST', path: '/v1/orders' },
      }),
    ]);
  });

  it('ServiceUnavailableException: 503 com log', () => {
    filter.catch(new ServiceUnavailableException('Redis down'), httpHost());

    expect(reply.body).toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE' });
    expect(logger.entries).toEqual([expect.objectContaining({ level: 'error' })]);
  });

  it('erro de domínio 5xx: responde o status registrado, sem log', () => {
    filter.catch(new PaymentUnavailableError('Payment provider unavailable'), httpHost());

    expect(reply.body).toMatchObject({ status: 503, code: 'PAYMENT_UNAVAILABLE' });
    expect(logger.entries).toEqual([]);
  });

  it('com os headers já enviados, só encerra a resposta', () => {
    filter.catch(new Error('boom'), httpHost('/v1/x', 'GET', 'http', { headersSent: true }));

    expect(reply.ended).toBe(true);
    expect(reply.body).toBeUndefined();
    expect(reply.headers).toEqual({});
  });

  it('fora do contexto HTTP, relança o erro', () => {
    const error = new Error('job failed');
    expect(() => filter.catch(error, httpHost('/', 'GET', 'rpc'))).toThrow(error);
    expect(reply.body).toBeUndefined();
  });

  it('o instance não leva a query string', () => {
    filter.catch(new NotFoundException(), httpHost('/v1/orders?page=2&size=10'));
    expect(reply.body?.instance).toBe('/v1/orders');
  });

  describe('traceId', () => {
    beforeAll(() => {
      context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
      trace.setGlobalTracerProvider(new TracerProvider());
    });
    afterAll(() => {
      context.disable();
      trace.disable();
    });

    it('vai no corpo com um span ativo', () => {
      const span = trace.getTracer('test').startSpan('GET /v1/orders/:id');
      context.with(trace.setSpan(context.active(), span), () =>
        filter.catch(new NotFoundException(), httpHost()),
      );
      span.end();
      expect(reply.body?.traceId).toBe(span.spanContext().traceId);
    });

    it('não vai sem span ativo', () => {
      filter.catch(new NotFoundException(), httpHost());
      expect(reply.body).not.toHaveProperty('traceId');
    });
  });
});
