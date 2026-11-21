import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';

export function configureApp(app: INestApplication) {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  return app;
}
