import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { Logger } from '../../application/ports/logger';
import { EnvironmentVariables } from '../config/env.validation';
import { PinoAppLogger } from './pino-app-logger';
import { isHealthRequest } from './ignored-paths';
import { TracingShutdown } from './tracing-lifecycle';

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
            const id = typeof header === 'string' && REQUEST_ID_PATTERN.test(header) ? header : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
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
