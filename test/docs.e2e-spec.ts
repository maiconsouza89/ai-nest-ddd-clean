import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestApp } from './helpers/test-app.js';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PROBLEM_JSON } from '#shared/infra/http/problem-details.response';
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

  const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
  const problemRef = '#/components/schemas/ProblemDetailsResponse';
  type Responses = Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
  const problemSchemaOf = (responses: Responses | undefined, status: string) =>
    responses?.[status]?.content?.[PROBLEM_JSON]?.schema?.$ref;

  it('toda rota tem exatamente uma tag', () => {
    const untagged = Object.entries(document.paths).flatMap(([path, item]) =>
      methods
        .filter((m) => item[m] && item[m].tags?.length !== 1)
        .map((m) => `${m.toUpperCase()} ${path}`),
    );
    expect(untagged).toEqual([]);
  });

  it('documenta o schema de Problem Details', () => {
    const schema = document.components?.schemas?.ProblemDetailsResponse as
      { properties?: Record<string, unknown> } | undefined;
    expect(Object.keys(schema?.properties ?? {})).toEqual(
      expect.arrayContaining(['type', 'title', 'status', 'detail', 'instance', 'code', 'traceId']),
    );
  });

  it('toda operação documenta o 429 e o 500 em application/problem+json', () => {
    const missing = Object.entries(document.paths).flatMap(([path, item]) =>
      methods
        .filter((m) => item[m])
        .filter((m) =>
          ['429', '500'].some(
            (status) => problemSchemaOf(item[m]!.responses as Responses, status) !== problemRef,
          ),
        )
        .map((m) => `${m.toUpperCase()} ${path}`),
    );
    expect(missing).toEqual([]);
  });

  it('o login documenta o 401 em application/problem+json', () => {
    const responses = document.paths['/v1/auth/login']?.post?.responses as Responses;
    expect(problemSchemaOf(responses, '401')).toBe(problemRef);
  });
});
