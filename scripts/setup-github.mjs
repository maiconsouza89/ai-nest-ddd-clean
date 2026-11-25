// Cria o ruleset da branch padrão no repositório do remote `origin`, pelo `gh`. O que ele exige está
// em docs/reference/comandos.md#ci: os checks ci, dependency-review e verify-lockfile e, quando o code
// scanning está disponível, a análise do CodeQL. Rodar de novo atualiza o mesmo ruleset, achado pelo
// nome, e mantém o que foi acrescentado nele pela interface do GitHub: bypass e regras de outros tipos.
// Também deixa o squash como único jeito de fazer merge de PR, com o título e a descrição do PR no
// commit, apaga o branch do PR depois do merge e, em repositório público, liga o relato privado de
// vulnerabilidade. Liga os Dependabot alerts, os security updates e a exigência de action fixada por
// SHA. A política "Require lockfile" não tem API e fica à mão; o secret scanning fica desligado.
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const RULESET_NAME = 'branch padrão';
// O app do GitHub Actions: só um check publicado por ele satisfaz a regra, e não um status qualquer
// com o mesmo nome criado pela API.
const GITHUB_ACTIONS_APP_ID = 15368;

// Os nomes dos jobs de .github/workflows/: ci.yml, dependency-review.yml e verify-lockfile.yml.
const REQUIRED_CHECKS = ['ci', 'dependency-review', 'verify-lockfile'];

const rules = [
  { type: 'deletion' },
  { type: 'non_fast_forward' },
  {
    type: 'required_status_checks',
    parameters: {
      strict_required_status_checks_policy: false,
      required_status_checks: REQUIRED_CHECKS.map((context) => ({
        context,
        integration_id: GITHUB_ACTIONS_APP_ID,
      })),
    },
  },
];

// Barra o PR com alerta novo do CodeQL (.github/workflows/codeql.yml) nas linhas que ele muda.
const codeScanningRule = {
  type: 'code_scanning',
  parameters: {
    code_scanning_tools: [
      { tool: 'CodeQL', alerts_threshold: 'errors', security_alerts_threshold: 'high_or_higher' },
    ],
  },
};

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

// O code scanning existe em todo repositório público. Num privado ou interno, só com o GitHub Code
// Security ou o Advanced Security ligado.
let codeScanning = visibility === 'PUBLIC';
if (!codeScanning) {
  const details = run('gh', ['api', `repos/${repo}`]);
  if (!details.ok) fail(`não foi possível ler ${repo}:\n${details.stderr}`);
  const analysis = json(details.stdout, 'ler o repositório').security_and_analysis ?? {};
  codeScanning = [analysis.code_security, analysis.advanced_security].some(
    (feature) => feature?.status === 'enabled',
  );
}
if (codeScanning) rules.push(codeScanningRule);
else
  process.stdout.write(
    'Repositório privado ou interno sem o GitHub Code Security: o ruleset fica sem a regra do CodeQL.\n',
  );

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

// Os Dependabot alerts antes dos security updates, que dependem deles.
const alerts = run('gh', ['api', '--method', 'PUT', `repos/${repo}/vulnerability-alerts`]);
if (!alerts.ok) fail(`não foi possível ligar os Dependabot alerts em ${repo}:\n${alerts.stderr}`);
const fixes = run('gh', ['api', '--method', 'PUT', `repos/${repo}/automated-security-fixes`]);
if (!fixes.ok)
  fail(`não foi possível ligar os Dependabot security updates em ${repo}:\n${fixes.stderr}`);
process.stdout.write(`Dependabot alerts e security updates ligados em ${repo}.\n`);

// O PUT exige o enabled: reenvia o enabled e o allowed_actions como estão e só liga o SHA.
const actions = run('gh', ['api', `repos/${repo}/actions/permissions`]);
if (!actions.ok)
  fail(`não foi possível ler as permissões do GitHub Actions em ${repo}:\n${actions.stderr}`);
const { enabled, allowed_actions: allowedActions } = json(
  actions.stdout,
  'ler as permissões do GitHub Actions',
);
const pinning = run(
  'gh',
  ['api', '--method', 'PUT', `repos/${repo}/actions/permissions`, '--input', '-'],
  JSON.stringify({ enabled, allowed_actions: allowedActions, sha_pinning_required: true }),
);
if (!pinning.ok)
  fail(`não foi possível exigir action fixada por SHA em ${repo}:\n${pinning.stderr}`);
process.stdout.write(`Actions fixadas por SHA exigidas em ${repo}.\n`);

process.stdout.write(
  'Falta à mão: ligue a política "Require lockfile" em Settings → Actions → Policies (docs/reference/comandos.md#ci). O script não liga o secret scanning.\n',
);
