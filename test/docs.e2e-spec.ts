import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestApp } from './helpers/test-app';
import { Test } from '@nestjs/testing';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { setupSwagger } from '../src/shared/infra/http/swagger.setup';

describe('Docs (e2e)', () => {
  let app: TestApp;
  let document: ReturnType<typeof setupSwagger>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue({ pingCheck: async (key: string) => ({ [key]: { status: 'up' } }) })
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    document = setupSwagger(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('serve a UI em /docs sem token', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200);
  });

  it('agrupa as rotas v1 por módulo', () => {
    const tagsOf = (path: string, method: 'get' | 'post' | 'patch') =>
      (document.paths[path]?.[method] as { tags?: string[] } | undefined)?.tags;

    expect(tagsOf('/v1/auth/login', 'post')).toEqual(['auth']);
    expect(tagsOf('/v1/orders', 'post')).toEqual(['orders']);
    expect(tagsOf('/v1/orders/{id}/pay', 'post')).toEqual(['orders']);
    expect(tagsOf('/v1/products', 'get')).toEqual(['products']);
    expect(tagsOf('/health/live', 'get')).toEqual(['health']);
  });
});
