import { expect } from 'vitest';
import type { Response } from 'supertest';
import { PROBLEM_JSON } from '#shared/infra/http/problem-details.response';

/** Confere que a resposta saiu em Problem Details (`application/problem+json`, com ou sem charset). */
export function expectProblemJson(res: Response) {
  expect(res.headers['content-type']?.split(';')[0]).toBe(PROBLEM_JSON);
}
