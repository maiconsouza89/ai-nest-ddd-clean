// Cria o ruleset da branch padrão no repositório do remote `origin`, pelo `gh`. O que ele exige está
// em docs/reference/comandos.md#ci. Rodar de novo atualiza o mesmo ruleset, achado pelo nome, e mantém
// o que foi acrescentado nele pela interface do GitHub: bypass e regras de outros tipos. Também deixa
// o squash como único jeito de fazer merge de PR, com o título e a descrição do PR no commit, apaga o
// branch do PR depois do merge e, em repositório público, liga o relato privado de vulnerabilidade.
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const RULESET_NAME = 'branch padrão';
// O app do GitHub Actions: só um check publicado por ele satisfaz a regra, e não um status qualquer
// com o mesmo nome criado pela API.
const GITHUB_ACTIONS_APP_ID = 15368;

const rules = [
  { type: 'deletion' },
  { type: 'non_fast_forward' },
  {
    type: 'required_status_checks',
    parameters: {
      strict_required_status_checks_policy: false,
      required_status_checks: [{ context: 'ci', integration_id: GITHUB_ACTIONS_APP_ID }],
    },
  },
];

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function run(command, args, input) {
  const { status, stdout, stderr, error } = spawnSync(command, args, { input, encoding: 'utf8' });
  if (error) fail(`não foi possível rodar o ${command} (${error.message})`);
  return { ok: status === 0, stdout: stdout.trim(), stderr };
}

function json(text, what) {
  try {
    return JSON.parse(text);
  } catch {
    return fail(`resposta inesperada do gh ao ${what}:\n${text}`);
  }
}

if (!run('gh', ['auth', 'status', '--hostname', 'github.com']).ok)
  fail('o gh não está autenticado no github.com. Rode `gh auth login` e tente de novo.');

// O `origin`, e não a escolha do `gh`, que prefere um remote `upstream` e configuraria o repositório
// de onde o template veio.
const origin = run('git', ['remote', 'get-url', 'origin']);
if (!origin.ok)
  fail('este clone não tem o remote `origin` apontando para o repositório no GitHub.');
const view = run('gh', ['repo', 'view', origin.stdout, '--json', 'nameWithOwner,visibility']);
if (!view.ok)
  fail(`não achei no GitHub o repositório do origin (${origin.stdout}):\n${view.stderr}`);
const { nameWithOwner: repo, visibility } = json(view.stdout, 'ler o repositório');

// Só os rulesets do próprio repositório, de todas as páginas: um da organização com o mesmo nome não conta.
const list = run('gh', [
  'api',
  '--paginate',
  `repos/${repo}/rulesets?includes_parents=false`,
  '--jq',
  `.[] | select(.name == "${RULESET_NAME}") | .id`,
]);
if (!list.ok) fail(`não foi possível listar os rulesets de ${repo}:\n${list.stderr}`);
const existingId = list.stdout.split('\n')[0];

let bypassActors = [];
let otherRules = [];
if (existingId) {
  const current = run('gh', ['api', `repos/${repo}/rulesets/${existingId}`]);
  if (!current.ok)
    fail(`não foi possível ler o ruleset ${existingId} de ${repo}:\n${current.stderr}`);
  const ruleset = json(current.stdout, 'ler o ruleset');
  const ours = new Set(rules.map((r) => r.type));
  bypassActors = ruleset.bypass_actors ?? [];
  otherRules = (ruleset.rules ?? []).filter((r) => !ours.has(r.type));
}

const body = {
  name: RULESET_NAME,
  target: 'branch',
  enforcement: 'active',
  bypass_actors: bypassActors,
  conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
  rules: [...otherRules, ...rules],
};
const [method, path] = existingId
  ? ['PUT', `repos/${repo}/rulesets/${existingId}`]
  : ['POST', `repos/${repo}/rulesets`];
const result = run('gh', ['api', '--method', method, path, '--input', '-'], JSON.stringify(body));
if (!result.ok) {
  const hint = /upgrade|plan/i.test(result.stderr)
    ? '\nO plano da conta não permite rulesets neste repositório.'
    : '';
  fail(`o GitHub recusou o ruleset de ${repo}:\n${result.stderr}${hint}`);
}

process.stdout.write(
  `${existingId ? 'Atualizado' : 'Criado'} o ruleset "${RULESET_NAME}" em ${repo} (docs/reference/comandos.md#ci).\n`,
);

// Merge de PR só por squash (um commit por PR na branch padrão), e o branch do PR some depois dele.
// O commit leva o título do PR, em Conventional Commits (.github/CONTRIBUTING.md), mesmo num PR de
// um commit só.
const merge = run('gh', [
  'api',
  '--method',
  'PATCH',
  `repos/${repo}`,
  '-F',
  'allow_squash_merge=true',
  '-F',
  'allow_merge_commit=false',
  '-F',
  'allow_rebase_merge=false',
  '-F',
  'delete_branch_on_merge=true',
  '-f',
  'squash_merge_commit_title=PR_TITLE',
  '-f',
  'squash_merge_commit_message=PR_BODY',
]);
if (!merge.ok) fail(`não foi possível configurar o merge de PR em ${repo}:\n${merge.stderr}`);
process.stdout.write(
  `Merge de PR em ${repo} só por squash, com o título e a descrição do PR, apagando o branch depois.\n`,
);

// O canal do .github/SECURITY.md. O GitHub só oferece o relato privado em repositório público.
if (visibility === 'PUBLIC') {
  const pvr = run('gh', [
    'api',
    '--method',
    'PUT',
    `repos/${repo}/private-vulnerability-reporting`,
  ]);
  if (!pvr.ok)
    fail(`não foi possível ligar o relato privado de vulnerabilidade em ${repo}:\n${pvr.stderr}`);
  process.stdout.write(`Relato privado de vulnerabilidade ligado em ${repo}.\n`);
} else {
  process.stdout.write(
    'Repositório privado ou interno: o private vulnerability reporting não está disponível. Ajuste o canal no .github/SECURITY.md.\n',
  );
}
