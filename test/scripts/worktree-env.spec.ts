import { describe, expect, it } from 'vitest';
import { parse } from 'dotenv';
import {
  GENERATED_MARKER,
  composeProjectName,
  filterEnvLocal,
  normalizeProjectName,
  parseWorktreeList,
  pickSlot,
  renderEnv,
  slotFromEnv,
  worktreeValues,
} from '../../scripts/worktree-env.mjs';

const MAIN_ENV = [
  'NODE_ENV=development',
  'PORT=3000',
  'DATABASE_URL=postgres://postgres:postgres@localhost:5432/app',
  '# cache, filas e rate limit',
  'REDIS_URL=redis://localhost:6379',
  'SMTP_URL=smtp://127.0.0.1:1025',
  'OTEL_SERVICE_NAME=ai-nest-ddd-clean',
  '',
].join('\n');

const values = (slot: number, env = MAIN_ENV) => worktreeValues(parse(env), slot, 'ddd-clean-nest');
const allFree = () => Promise.resolve(true);

describe('parseWorktreeList', () => {
  it('devolve os caminhos, o principal primeiro', () => {
    const porcelain = [
      'worktree /repo',
      'HEAD abc',
      'branch refs/heads/main',
      '',
      'worktree /home/u/.herdr/worktrees/repo/feat',
      'HEAD def',
      'detached',
      '',
    ].join('\n');
    expect(parseWorktreeList(porcelain)).toEqual(['/repo', '/home/u/.herdr/worktrees/repo/feat']);
  });
});

describe('slotFromEnv', () => {
  it('lê o slot gravado', () => {
    expect(slotFromEnv(parse('PORT=3002\nWORKTREE_SLOT=2\n'))).toBe(2);
  });

  it.each(['', 'WORKTREE_SLOT=0', 'WORKTREE_SLOT=16', 'WORKTREE_SLOT=abc'])(
    'ignora "%s"',
    (content) => {
      expect(slotFromEnv(parse(content))).toBeUndefined();
    },
  );
});

describe('pickSlot', () => {
  it('mantém o slot já gravado, sem olhar a porta', async () => {
    const isPortFree = () => Promise.resolve(false);
    expect(await pickSlot({ current: 7, reserved: new Set([1]), isPortFree })).toEqual({
      slot: 7,
      fresh: false,
    });
  });

  it('troca o slot gravado que outro worktree já usa, como num .env copiado', async () => {
    expect(await pickSlot({ current: 1, reserved: new Set([1]), isPortFree: allFree })).toEqual({
      slot: 2,
      fresh: true,
    });
  });

  it('reserva o menor livre', async () => {
    expect(
      await pickSlot({ current: undefined, reserved: new Set(), isPortFree: allFree }),
    ).toEqual({ slot: 1, fresh: true });
  });

  it('pula os slots de outros worktrees e as portas ocupadas', async () => {
    const isPortFree = (port: number) => Promise.resolve(port !== 3003);
    const picked = await pickSlot({ current: undefined, reserved: new Set([1, 2]), isPortFree });
    expect(picked).toEqual({ slot: 4, fresh: true });
  });

  it('sem slot livre, devolve undefined', async () => {
    const reserved = new Set(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(await pickSlot({ current: undefined, reserved, isPortFree: allFree })).toBeUndefined();
  });
});

describe('composeProjectName', () => {
  it('usa o do .env do principal', () => {
    expect(composeProjectName({ COMPOSE_PROJECT_NAME: 'meu-stack' }, '/x/repo')).toBe('meu-stack');
  });

  it('sem ele, normaliza o nome da pasta como o Compose', () => {
    expect(composeProjectName({}, '/x/My.Repo Nest')).toBe('myreponest');
    expect(normalizeProjectName('_-Ddd_Clean-Nest!')).toBe('ddd_clean-nest');
  });
});

describe('worktreeValues', () => {
  it('reescreve as quatro conexões para o slot', () => {
    const v = values(3);
    expect(v.PORT).toBe('3003');
    expect(v.DATABASE_URL).toBe('postgres://postgres:postgres@localhost:5432/app_wt3');
    expect(v.REDIS_URL).toBe('redis://localhost:6379/3');
    expect(v.SMTP_URL).toBe('smtp://wt3:x@127.0.0.1:1025');
    expect(v.MAILPIT_TAG).toBe('wt3');
    expect(v.WORKTREE_SLOT).toBe('3');
    expect(v.COMPOSE_PROJECT_NAME).toBe('ddd-clean-nest');
  });

  it('troca o banco lógico do Redis que já estiver na URL e mantém a query do Postgres', () => {
    const env = MAIN_ENV.replace('6379', '6379/0').replace('/app', '/app?sslmode=disable');
    const v = values(2, env);
    expect(v.REDIS_URL).toBe('redis://localhost:6379/2');
    expect(v.DATABASE_URL).toBe(
      'postgres://postgres:postgres@localhost:5432/app_wt2?sslmode=disable',
    );
  });

  it('soma o ambiente ao OTEL_RESOURCE_ATTRIBUTES sem perder os outros atributos', () => {
    const env = `${MAIN_ENV}OTEL_RESOURCE_ATTRIBUTES=team=core,deployment.environment.name=dev\n`;
    expect(values(1, env).OTEL_RESOURCE_ATTRIBUTES).toBe(
      'team=core,deployment.environment.name=wt1',
    );
    expect(values(1).OTEL_RESOURCE_ATTRIBUTES).toBe('deployment.environment.name=wt1');
  });

  it('falha sem uma das URLs no .env do principal', () => {
    expect(() => values(1, MAIN_ENV.replace(/^REDIS_URL=.*$/m, ''))).toThrow(/REDIS_URL/);
  });
});

describe('renderEnv', () => {
  it('reescreve no lugar e põe as chaves que faltam no bloco final', () => {
    const rendered = renderEnv(MAIN_ENV, values(1));
    const lines = rendered.split('\n');
    expect(lines.slice(0, 7)).toEqual([
      'NODE_ENV=development',
      'PORT=3001',
      'DATABASE_URL=postgres://postgres:postgres@localhost:5432/app_wt1',
      '# cache, filas e rate limit',
      'REDIS_URL=redis://localhost:6379/1',
      'SMTP_URL=smtp://wt1:x@127.0.0.1:1025',
      'OTEL_SERVICE_NAME=ai-nest-ddd-clean',
    ]);
    const block = lines.slice(lines.indexOf(GENERATED_MARKER) + 1).filter(Boolean);
    expect(block.map((line) => line.split('=')[0])).toEqual([
      'WORKTREE_SLOT',
      'MAILPIT_TAG',
      'COMPOSE_PROJECT_NAME',
      'OTEL_RESOURCE_ATTRIBUTES',
    ]);
    expect(parse(rendered).WORKTREE_SLOT).toBe('1');
  });

  it('rodar sobre o próprio resultado não duplica chaves', () => {
    const once = renderEnv(MAIN_ENV, values(1));
    expect(renderEnv(once, values(1))).toBe(once);
    expect(once.split(GENERATED_MARKER)).toHaveLength(2);
  });

  it('reescreve no lugar uma chave do worktree que o principal já tenha', () => {
    const env = `${MAIN_ENV}COMPOSE_PROJECT_NAME=outro\n`;
    const rendered = renderEnv(env, values(1, env));
    expect(rendered.match(/^COMPOSE_PROJECT_NAME=/gm)).toHaveLength(1);
  });
});

describe('filterEnvLocal', () => {
  it('tira as chaves do worktree e diz quais saíram', () => {
    const local = 'LOG_LEVEL=debug\nDATABASE_URL=postgres://x/app\n# PORT=1\nexport PORT=4000\n';
    expect(filterEnvLocal(local, Object.keys(values(1)))).toEqual({
      content: 'LOG_LEVEL=debug\n# PORT=1\n',
      removed: ['DATABASE_URL', 'PORT'],
    });
  });
});
