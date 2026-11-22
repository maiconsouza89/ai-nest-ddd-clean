import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { Logger } from '../../application/ports/logger.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { PinoAppLogger } from './pino-app-logger.js';
import { isHealthRequest } from './ignored-paths.js';
import { TracingShutdown } from './tracing-lifecycle.js';

const REQUEST_ID_PATTERN = /^[\w-]{1,128}$/;

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          // reaproveita o id do proxy/gateway só se for curto e simples; senão gera um
          genReqId: (req, res) => {
            const header = req.headers['x-request-id'];
            const id =
              typeof header === 'string' && REQUEST_ID_PATTERN.test(header) ? header : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          // desenvolvimento: saída colorida e em uma linha; produção segue em JSON para o coletor
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'HH:MM:ss.l',
                    ignore: 'pid,hostname,req,res',
                  },
                }
              : undefined,
          // o log de requisição já traz método, url, status e duração na mensagem
          customSuccessMessage: (req, res, ms) =>
            `${req.method} ${req.url} ${res.statusCode} ${Math.round(ms)}ms`,
          customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode} failed`,
          serializers: {
            req: (req: { id: unknown; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          autoLogging: { ignore: (req) => isHealthRequest(req.url) },
        },
      }),
    }),
  ],
  providers: [{ provide: Logger, useClass: PinoAppLogger }, TracingShutdown],
  exports: [Logger],
})
export class ObservabilityModule {}
