// `npm run worktree:setup` e `npm run worktree:down`: o ambiente próprio de um git worktree sobre o Postgres,
// o Redis e o Mailpit do checkout principal, isolado por um slot de 1 a 15 (porta, banco, banco lógico do
// Redis e tag do Mailpit). A lógica pura fica em worktree-env.mjs. Como usar:
// docs/how-to/trabalhar-com-worktrees-em-paralelo.md. Roda na raiz do worktree, que no `npm run` é o cwd.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  composeProjectName,
  filterEnvLocal,
  parseWorktreeList,
  pickSlot,
  renderEnv,
  slotDatabase,
  slotFromEnv,
  slotTag,
  worktreeValues,
} from './worktree-env.mjs';

// o mesmo padrão do test/helpers/mailpit.ts
const mailpitApi = (env) => env.MAILPIT_API_URL || 'http://127.0.0.1:8025';

function fail(message) {
  process.stderr.write(`worktree: ${message}\n`);
  process.exit(1);
}

const log = (message) => process.stdout.write(`worktree: ${message}\n`);
const readIfExists = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined);

// As dependências do npm entram por import(): num worktree novo, só existem depois do `npm ci` do setup.
async function parseEnv(content) {
  const { parse } = await import('dotenv');
  return parse(content ?? '');
}
const readEnv = (file) => parseEnv(readIfExists(file));

function run(command, args) {
  const { status, error } = spawnSync(command, args, { stdio: 'inherit' });
  if (error) fail(`não foi possível rodar ${command} ${args.join(' ')}: ${error.message}`);
  if (status !== 0) fail(`${command} ${args.join(' ')} saiu com ${status}`);
}

/** A raiz deste checkout e a do principal. Recusa no principal, onde o `.git` é um diretório. */
function checkouts() {
  const root = process.cwd();
  const gitPath = path.join(root, '.git');
  if (!existsSync(gitPath)) fail('rode na raiz do worktree (não achei o .git)');
  if (statSync(gitPath).isDirectory())
    fail('este é o checkout principal; o worktree:setup e o worktree:down são só para worktrees');
  const porcelain = execFileSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8' });
  const [main, ...linked] = parseWorktreeList(porcelain);
  return { root, main, others: linked.filter((dir) => path.resolve(dir) !== root) };
}

/**
 * Roda `work` com uma trava no diretório comum do git, para dois setups ao mesmo tempo não reservarem o mesmo
 * slot. A trava cobre só a escolha do slot e a escrita do `.env`; uma com mais de 30 s é de um setup que morreu.
 */
async function withSlotLock(work) {
  const commonDir = execFileSync(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    {
      encoding: 'utf8',
    },
  ).trim();
  const lock = path.join(commonDir, 'worktree-slot.lock');
  for (let attempt = 0; ; attempt++) {
    try {
      closeSync(openSync(lock, 'wx'));
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const age = Date.now() - (statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (age > 30_000) rmSync(lock, { force: true });
      else if (attempt >= 100)
        fail(`outro worktree:setup segura ${lock}; se nenhum estiver rodando, apague o arquivo`);
      else await sleep(100);
    }
  }
  try {
    return await work();
  } finally {
    rmSync(lock, { force: true });
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, () => server.close(() => resolve(true)));
  });
}

/** Apaga o banco do slot, esvazia o banco lógico dele no Redis e as mensagens da tag no Mailpit. */
async function wipeSlot(slot, values, mailpit) {
  await Promise.all([
    withPostgres(values.DATABASE_URL, (client) =>
      client.query(`DROP DATABASE IF EXISTS "${slotDatabase(slot)}" WITH (FORCE)`),
    ),
    flushRedis(values.REDIS_URL),
    deleteTaggedMessages(slotTag(slot), mailpit),
  ]);
}

async function flushRedis(redisUrl) {
  const { Redis } = await import('ioredis');
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}

async function deleteTaggedMessages(tag, mailpit) {
  const query = encodeURIComponent(`tag:${tag}`);
  const res = await fetch(`${mailpit}/api/v1/search?query=${query}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`o Mailpit respondeu ${res.status} ao apagar as mensagens da tag`);
}

/** Roda `work` no banco `postgres` do servidor da URL, por onde passam o CREATE e o DROP DATABASE. */
async function withPostgres(databaseUrl, work) {
  const url = new URL(databaseUrl);
  url.pathname = '/postgres';
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function createDatabaseIfMissing(slot, databaseUrl) {
  const name = slotDatabase(slot);
  await withPostgres(databaseUrl, async (client) => {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
  });
}

async function setup(options) {
  const { root, main, others } = checkouts();
  const mainEnvContent = readIfExists(path.join(main, '.env'));
  if (mainEnvContent === undefined)
    fail(`o checkout principal não tem .env: rode \`cp .env.example .env\` em ${main}`);

  if (options.install || !existsSync(path.join(root, 'node_modules'))) run('npm', ['ci']);
  else log('node_modules já existe: pulei o npm ci (--install força)');

  const mainEnv = await parseEnv(mainEnvContent);
  const mainLocal = readIfExists(path.join(main, '.env.local'));
  // as URLs que o principal usa de fato: o .env.local vence o .env, como na app
  const baseEnv = { ...mainEnv, ...(await parseEnv(mainLocal)) };
  // o Compose lê o COMPOSE_PROJECT_NAME só do .env
  const projectName = composeProjectName(mainEnv, main);

  const { slot, fresh, values } = await withSlotLock(async () => {
    const current = slotFromEnv(await readEnv(path.join(root, '.env')));
    const reserved = new Map();
    for (const dir of others) {
      const slot = slotFromEnv(await readEnv(path.join(dir, '.env')));
      if (slot !== undefined) reserved.set(slot, dir);
    }
    if (reserved.has(current))
      log(`o slot ${current} do .env é de ${reserved.get(current)}: este worktree ganha outro`);
    const picked = await pickSlot({ current, reserved, isPortFree });
    if (!picked) {
      const list = [...reserved].map(([slot, dir]) => `  ${slot}: ${dir}`).join('\n');
      fail(`nenhum slot livre de 1 a 15. Worktrees e slots:\n${list}`);
    }
    const values = worktreeValues(baseEnv, picked.slot, projectName);
    writeFileSync(path.join(root, '.env'), renderEnv(mainEnvContent, values));
    return { ...picked, values };
  });
  log(fresh ? `slot ${slot} reservado` : `slot ${slot} mantido`);
  log('.env gerado a partir do .env do principal');

  // sem .env.local no principal, o do worktree fica, mas sem as chaves que venceriam o .env gerado
  const local = mainLocal ?? readIfExists(path.join(root, '.env.local'));
  if (local !== undefined) {
    const { content, removed } = filterEnvLocal(local, Object.keys(values));
    writeFileSync(path.join(root, '.env.local'), content);
    const origin = mainLocal === undefined ? 'do worktree mantido' : 'copiado do principal';
    log(
      `.env.local ${origin}${removed.length ? ` sem ${removed.join(', ')} (o .env gerado as define)` : ''}`,
    );
  }

  // o docker-compose.yml do principal, e não o da branch: um compose diferente recriaria o stack de todos
  const composeFile = path.join(main, 'docker-compose.yml');
  run('docker', [
    'compose',
    '-f',
    composeFile,
    'up',
    '-d',
    '--wait',
    'postgres',
    'redis',
    'mailpit',
  ]);

  const mailpit = mailpitApi(mainEnv);
  if (fresh) {
    await wipeSlot(slot, values, mailpit);
    log(`dados que um worktree antigo deixou no slot ${slot} apagados`);
  }
  await createDatabaseIfMissing(slot, values.DATABASE_URL);

  run('npm', ['run', 'db:setup']);
  run('npm', ['run', 'db:seed']);

  const tag = slotTag(slot);
  process.stdout.write(
    [
      '',
      `Worktree no slot ${slot}:`,
      `  API      http://localhost:${values.PORT}`,
      `  Postgres ${slotDatabase(slot)}`,
      `  Redis    banco lógico ${slot}`,
      `  Mailpit  ${mailpit}/#search?q=tag:${tag}`,
      '',
      'Para limpar: npm run worktree:down. Nunca docker compose down -v aqui: apaga os dados de todos.',
      '',
    ].join('\n'),
  );
}

async function down() {
  const { root, main } = checkouts();
  const env = await readEnv(path.join(root, '.env'));
  const slot = slotFromEnv(env);
  if (slot === undefined) fail('este worktree não tem WORKTREE_SLOT no .env: não há o que limpar');
  // recalculado pelo slot: mesmo com o .env editado à mão, o down nunca mira o banco `app` nem o Redis 0
  const values = worktreeValues(env, slot, composeProjectName(env, main));
  await wipeSlot(slot, values, mailpitApi(env));
  log(
    `apagados o banco ${slotDatabase(slot)}, o banco lógico ${slot} do Redis e as mensagens da tag ${slotTag(slot)}`,
  );
  log(
    `o slot continua reservado enquanto o worktree existir; para liberá-lo, git worktree remove ${root}`,
  );
}

const [command, ...flags] = process.argv.slice(2);
try {
  if (command === 'setup') await setup({ install: flags.includes('--install') });
  else if (command === 'down') await down();
  else fail('uso: node scripts/worktree.mjs <setup [--install] | down>');
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
