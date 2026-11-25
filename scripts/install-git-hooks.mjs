// `prepare` do npm: instala os hooks do git do `lefthook.yml` com o `lefthook install`. Não faz nada no CI,
// com `LEFTHOOK=0`, sem `.git` na raiz (o build da imagem) e num worktree linkado, onde os hooks já valem
// porque moram no diretório comum do git, instalados pelo checkout principal. Nunca quebra o `npm install`:
// uma falha vira aviso. Como funcionam e como pulá-los: docs/reference/comandos.md#hooks-do-git
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import process from 'node:process';

const LEFTHOOK = 'node_modules/lefthook/bin/index.js';

const log = (message) => process.stdout.write(`install-git-hooks: ${message}\n`);

// a regra do postinstall do lefthook: qualquer valor fora de vazio, `0` e `false` liga
const isEnabled = (value) => Boolean(value) && value !== '0' && value !== 'false';

function skipReason() {
  if (isEnabled(process.env.CI)) return 'CI ligado, hooks não instalados';
  if (process.env.LEFTHOOK === '0') return 'LEFTHOOK=0, hooks não instalados';
  if (!existsSync('.git')) return 'sem .git na raiz, hooks não instalados';
  // a mesma checagem do worktree-guard.mjs
  if (statSync('.git').isFile())
    return 'worktree linkado: os hooks do checkout principal já valem aqui';
  return undefined;
}

const reason = skipReason();
if (reason) {
  log(reason);
} else {
  const { status, error } = existsSync(LEFTHOOK)
    ? spawnSync(process.execPath, [LEFTHOOK, 'install'], { stdio: 'inherit' })
    : { error: new Error(`${LEFTHOOK} não existe`) };
  if (error || status !== 0) {
    log(
      `não consegui instalar os hooks (${error?.message ?? `saída ${status}`}). Rode à mão: npx lefthook install`,
    );
  }
}
