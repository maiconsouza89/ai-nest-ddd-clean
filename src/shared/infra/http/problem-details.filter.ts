import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { STATUS_CODES } from 'node:http';
import { Logger } from '../../application/ports/logger.js';
import { DomainError } from '../../domain/domain-error.js';
import { currentTraceId } from '../observability/trace-context.js';
import { ErrorStatusRegistry } from './error-status.registry.js';
import {
  PROBLEM_JSON,
  ProblemDetailsResponse,
  ValidationProblemResponse,
} from './problem-details.response.js';

// chave que o ValidationPipe põe no `grouped` quando as mensagens passam do `maxErrorMessagesLength`
const OMITTED_ERRORS_KEY = '...';

type Problem = Pick<ProblemDetailsResponse, 'status' | 'code' | 'detail' | 'errors'>;

/**
 * Monta toda resposta de erro da API em Problem Details (RFC 9457). Registrado por `APP_FILTER` no
 * `ProblemDetailsModule`. O status de um erro de domínio vem do `ErrorStatusRegistry`.
 */
@Catch()
@Injectable()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly statuses: ErrorStatusRegistry,
    private readonly logger: Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // fila, job ou outro contexto: o erro segue para quem chamou
    if (host.getType() !== 'http') throw exception;

    const { httpAdapter } = this.adapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<unknown>();
    const method = httpAdapter.getRequestMethod(request) as string;
    const path = (httpAdapter.getRequestUrl(request) as string).split('?')[0];

    const problem = this.toProblem(exception);
    // o erro de domínio 5xx (PAYMENT_UNAVAILABLE) é esperado: quem o lança já loga a causa
    if (problem.status >= 500 && !(exception instanceof DomainError)) {
      this.logger.error({ err: exception, method, path }, `${method} ${path} ${problem.status}`);
    }

    const traceId = currentTraceId();
    const body: ProblemDetailsResponse = {
      type: 'about:blank',
      title: STATUS_CODES[problem.status] ?? 'Unknown Error',
      status: problem.status,
      detail: problem.detail,
      instance: path,
      code: problem.code,
      ...(traceId && { traceId }),
      ...(problem.errors && { errors: problem.errors }),
    };
    const response = ctx.getResponse<unknown>();
    // a rota já começou a responder (stream, @Res()): só resta encerrar
    if (httpAdapter.isHeadersSent(response)) {
      httpAdapter.end(response);
      return;
    }
    httpAdapter.setHeader(response, 'Content-Type', PROBLEM_JSON);
    httpAdapter.reply(response, body, problem.status);
  }

  private toProblem(exception: unknown): Problem {
    if (exception instanceof DomainError) {
      const status = this.statuses.statusOf(exception.code);
      if (status === undefined) {
        this.logger.warn({ code: exception.code }, 'error code without a registered HTTP status');
      }
      return {
        status: status ?? HttpStatus.UNPROCESSABLE_ENTITY,
        code: exception.code,
        detail: exception.message,
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const errors = validationErrors(exception);
      if (errors) {
        return { status, code: 'VALIDATION_FAILED', detail: 'Validation failed.', errors };
      }
      const name = HttpStatus[status] as string | undefined;
      return { status, code: name ?? `HTTP_${status}`, detail: exception.message };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred.',
    };
  }
}

/**
 * Converte o corpo do `ValidationPipe` com `errorFormat: 'grouped'`
 * (`{ message: { 'items.0.quantity': [...] } }`) num item por mensagem. Outro corpo: `undefined`.
 */
function validationErrors(exception: HttpException): ValidationProblemResponse[] | undefined {
  if (exception.getStatus() !== 400) return undefined;
  const body = exception.getResponse();
  if (!isRecord(body) || !isRecord(body.message)) return undefined;

  return Object.entries(body.message).flatMap(([path, messages]) => {
    const list = Array.isArray(messages) ? messages.map(String) : [String(messages)];
    // o aviso de mensagens omitidas não aponta para campo nenhum
    const pointer = path === OMITTED_ERRORS_KEY ? undefined : toJsonPointer(path);
    return list.map((detail) => ({ pointer, detail }));
  });
}

/** `items.0.quantity` → `#/items/0/quantity`, com `~` e `/` escapados (RFC 6901). */
function toJsonPointer(path: string): string {
  const segments = path.split('.').map((s) => s.replaceAll('~', '~0').replaceAll('/', '~1'));
  return `#/${segments.join('/')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
