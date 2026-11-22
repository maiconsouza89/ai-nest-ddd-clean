import { INestApplication, Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { EnvironmentVariables } from '#shared/infra/config/env.validation';

export function configureApp(app: INestApplication) {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  if (trustProxy === 0 && config.get('NODE_ENV', { infer: true }) === 'production') {
    // atrás de um proxy, todos os clientes compartilhariam o IP dele e o mesmo limite do throttler
    new Logger('App').warn(
      'TRUST_PROXY=0 em produção: se houver proxy ou load balancer, defina o número real de proxies.',
    );
  }
  (app as NestExpressApplication).set('trust proxy', trustProxy);
  app.use(helmet());
  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length) app.enableCors({ origin: origins });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  return app;
}
