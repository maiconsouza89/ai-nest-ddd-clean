// Pre-script do `start:dev`, do `test:e2e`, do `db:setup` e do `db:seed`: num worktree linkado (o `.git` da
// raiz é um arquivo) sem `WORKTREE_SLOT`, para antes de abrir conexão. Sem ele, o worktree rodaria contra o
// banco `app` e o Redis 0 do checkout principal em silêncio. No principal e no CI (`.git` é um diretório),
// não faz nada. Não abre processo do git: roda antes de cada um desses comandos.
import { existsSync, readFileSync, statSync } from 'node:fs';
import process from 'node:process';

const isLinkedWorktree = existsSync('.git') && statSync('.git').isFile();

async function hasSlot() {
  if (process.env.WORKTREE_SLOT) return true;
  // sem node_modules, o worktree ainda não passou pelo setup, que instala as dependências
  const dotenv = await import('dotenv').catch(() => undefined);
  if (!dotenv) return false;
  // a ordem do ENV_FILES (src/shared/infra/config/load-env-files.ts), que este script em JS puro não importa
  return ['.env.local', '.env'].some(
    (file) => existsSync(file) && Boolean(dotenv.parse(readFileSync(file, 'utf8')).WORKTREE_SLOT),
  );
}

if (isLinkedWorktree && !(await hasSlot())) {
  process.stderr.write(
    'Este checkout é um worktree sem ambiente próprio: rode `npm run worktree:setup`\n',
  );
  process.exit(1);
}
