// Roda, um depois do outro, cada script do package.json cujo nome casa com o padrão recebido, e para no
// primeiro que falhar. Usado pelo `db:setup` (`^mig:.+:run$`), pelo `db:migrate:prod`
// (`^mig:.+:run:prod$`) e pelo `db:seed` (`^seed:[^:]+$`): a lista sai do package.json, então um módulo
// novo entra sem editar este arquivo. A ordem não importa: cada módulo só mexe no próprio schema. Lê o
// package.json do diretório atual, que no `npm run` é a raiz.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const [pattern] = process.argv.slice(2);
if (!pattern) {
  process.stderr.write('uso: node scripts/run-scripts.mjs <padrão dos nomes de script>\n');
  process.exit(1);
}

const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'));
const regex = new RegExp(pattern);
// fora o script que chamou este (o `db:seed`, por exemplo), que um padrão frouxo faria rodar a si mesmo sem fim
const caller = process.env.npm_lifecycle_event;
const matching = Object.keys(scripts).filter((name) => name !== caller && regex.test(name));
if (matching.length === 0) {
  process.stderr.write(`nenhum script do package.json casa com ${pattern}\n`);
  process.exit(1);
}

for (const script of matching) {
  const { status, error } = spawnSync('npm', ['run', script], { stdio: 'inherit' });
  if (error) process.stderr.write(`não foi possível rodar npm run ${script}: ${error.message}\n`);
  if (status !== 0) process.exit(status ?? 1);
}
