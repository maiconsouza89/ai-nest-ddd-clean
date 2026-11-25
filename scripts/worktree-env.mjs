// Lógica pura do `worktree:setup` e do `worktree:down` (scripts/worktree.mjs): o slot, o `.env` gerado e o
// `.env.local` filtrado. Sem git, rede, disco nem dependência do npm (o setup a carrega antes do `npm ci`),
// para os unitários (test/scripts/worktree-env.spec.ts). Quem chama passa o `.env` já lido pelo `dotenv`.
// O porquê do desenho: docs/adr/0011-worktrees-compartilham-o-stack-do-checkout-principal.md.
import path from 'node:path';

/** O teto vem dos 16 bancos lógicos do Redis: o 0 é do checkout principal. */
const MAX_SLOT = 15;
const BASE_PORT = 3000;
export const GENERATED_MARKER = '# gerado pelo worktree:setup; rode de novo para regerar';

const ENVIRONMENT_ATTRIBUTE = 'deployment.environment.name';

export const slotTag = (slot) => `wt${slot}`;
export const slotDatabase = (slot) => `app_wt${slot}`;
const slotPort = (slot) => BASE_PORT + slot;

/** Os caminhos da saída de `git worktree list --porcelain`. O primeiro é o checkout principal. */
export function parseWorktreeList(porcelain) {
  return porcelain
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length));
}

/** O `WORKTREE_SLOT` das variáveis de um `.env`, ou `undefined` se ele não tem um slot válido. */
export function slotFromEnv(env) {
  const raw = env.WORKTREE_SLOT;
  if (raw === undefined || !/^\d+$/.test(raw)) return undefined;
  const slot = Number(raw);
  return slot >= 1 && slot <= MAX_SLOT ? slot : undefined;
}

/**
 * O slot do worktree: o `current`, se ele já tem um que nenhum outro worktree usa, ou o menor de 1 a 15 fora de
 * `reserved` (um Set ou as chaves de um Map) com a porta livre. Um `current` de outro worktree vem de um `.env`
 * copiado, e o worktree ganha outro slot. `fresh` diz se acabou de ser reservado. `undefined` sem slot livre.
 */
export async function pickSlot({ current, reserved, isPortFree }) {
  if (current !== undefined && !reserved.has(current)) return { slot: current, fresh: false };
  for (let slot = 1; slot <= MAX_SLOT; slot++) {
    if (reserved.has(slot)) continue;
    if (await isPortFree(slotPort(slot))) return { slot, fresh: true };
  }
  return undefined;
}

/** O nome do projeto como o Compose normaliza o da pasta: minúsculas, só `[a-z0-9_-]`, sem `_`/`-` no início. */
export function normalizeProjectName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/^[_-]+/, '');
}

/** O projeto do Compose do checkout principal: o `COMPOSE_PROJECT_NAME` do `.env` dele ou o nome da pasta. */
export function composeProjectName(mainEnv, mainDir) {
  return mainEnv.COMPOSE_PROJECT_NAME || normalizeProjectName(path.basename(mainDir));
}

function rewriteUrl(key, value, edit) {
  if (!value) throw new Error(`o .env do checkout principal não tem ${key}`);
  const url = new URL(value);
  edit(url);
  return url.toString();
}

/** O `OTEL_RESOURCE_ATTRIBUTES` com o ambiente do slot, mantendo os outros atributos. */
export function withEnvironmentAttribute(attributes, slot) {
  const kept = (attributes ?? '')
    .split(',')
    .map((pair) => pair.trim())
    .filter((pair) => pair && pair.split('=')[0].trim() !== ENVIRONMENT_ATTRIBUTE);
  return [...kept, `${ENVIRONMENT_ATTRIBUTE}=${slotTag(slot)}`].join(',');
}

/**
 * Os valores do slot a partir das variáveis do `.env` do principal: a porta, o banco do Postgres, o banco
 * lógico do Redis e o usuário SMTP (a tag do Mailpit), mais as chaves que só o worktree tem.
 */
export function worktreeValues(baseEnv, slot, projectName) {
  return {
    PORT: String(slotPort(slot)),
    DATABASE_URL: rewriteUrl('DATABASE_URL', baseEnv.DATABASE_URL, (url) => {
      url.pathname = `/${slotDatabase(slot)}`;
    }),
    REDIS_URL: rewriteUrl('REDIS_URL', baseEnv.REDIS_URL, (url) => {
      url.pathname = `/${slot}`;
    }),
    SMTP_URL: rewriteUrl('SMTP_URL', baseEnv.SMTP_URL, (url) => {
      url.username = slotTag(slot);
      url.password = 'x';
    }),
    WORKTREE_SLOT: String(slot),
    MAILPIT_TAG: slotTag(slot),
    COMPOSE_PROJECT_NAME: projectName,
    OTEL_RESOURCE_ATTRIBUTES: withEnvironmentAttribute(baseEnv.OTEL_RESOURCE_ATTRIBUTES, slot),
  };
}

const assignedKey = (line) => /^\s*(?:export\s+)?([\w.-]+)\s*=/.exec(line)?.[1];

/**
 * O `.env` do worktree: o do principal com as chaves de `values` reescritas no lugar, e as que faltam num
 * bloco final marcado. Um bloco gerado que já estivesse no conteúdo sai antes, para não duplicar chaves.
 */
export function renderEnv(baseContent, values) {
  const markerAt = baseContent.indexOf(GENERATED_MARKER);
  const base = markerAt === -1 ? baseContent : baseContent.slice(0, markerAt);
  const written = new Set();
  const lines = base
    .replace(/\s+$/, '')
    .split('\n')
    .map((line) => {
      const key = assignedKey(line);
      if (key === undefined || !(key in values)) return line;
      written.add(key);
      return `${key}=${values[key]}`;
    });
  const missing = Object.keys(values).filter((key) => !written.has(key));
  const block = missing.map((key) => `${key}=${values[key]}`);
  return [...lines, '', GENERATED_MARKER, ...block, ''].join('\n');
}

/** O `.env.local` do principal sem as chaves do worktree (`keys`), que venceriam as do `.env` gerado. */
export function filterEnvLocal(content, keys) {
  const removed = new Set();
  const kept = content.split('\n').filter((line) => {
    const key = assignedKey(line);
    if (key === undefined || !keys.includes(key)) return true;
    removed.add(key);
    return false;
  });
  return { content: kept.join('\n'), removed: [...removed] };
}
