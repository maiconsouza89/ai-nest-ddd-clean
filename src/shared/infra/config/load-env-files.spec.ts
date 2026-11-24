import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvFiles } from './load-env-files.js';

describe('loadEnvFiles', () => {
  let dir: string;
  let paths: string[];

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'load-env-files-'));
    paths = [join(dir, '.env.local'), join(dir, '.env')];
    writeFileSync(paths[0], 'FROM_LOCAL=local\nSHARED=local\n');
    writeFileSync(paths[1], 'FROM_ENV=env\nSHARED=env\nALREADY_SET=env\n');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('com NODE_ENV=production não lê arquivo nenhum', () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
    loadEnvFiles(env, paths);
    expect(env).toEqual({ NODE_ENV: 'production' });
  });

  it('fora de produção lê os dois arquivos, e a primeira definição vence', () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'development', ALREADY_SET: 'ambiente' };
    loadEnvFiles(env, paths);
    expect(env).toMatchObject({
      FROM_LOCAL: 'local',
      FROM_ENV: 'env',
      SHARED: 'local',
      ALREADY_SET: 'ambiente',
    });
  });
});
