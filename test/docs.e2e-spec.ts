import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestApp } from './helpers/test-app.js';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { setupSwagger } from '#shared/infra/http/swagger.setup';

describe('Docs (e2e)', () => {
  let app: TestApp;
  let document: ReturnType<typeof setupSwagger>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
    expect(tagsOf('/health/live', 'get')).toEqual(['health']);
  });

  it('toda rota tem exatamente uma tag', () => {
    const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
    const untagged = Object.entries(document.paths).flatMap(([path, item]) =>
      methods
        .filter((m) => item[m] && item[m].tags?.length !== 1)
        .map((m) => `${m.toUpperCase()} ${path}`),
    );
    expect(untagged).toEqual([]);
  });
});
