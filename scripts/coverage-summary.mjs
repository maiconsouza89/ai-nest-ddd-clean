// Tabela da cobertura dos unitários por camada (domain, application, contracts, infra e o resto), em Markdown,
// a partir do coverage/coverage-summary.json do `npm run test:coverage`. O job `unit` do CI a acrescenta ao
// resumo do job (`node scripts/coverage-summary.mjs >> "$GITHUB_STEP_SUMMARY"`). A lógica pura é o
// `coverageSummary`, sem disco, para os unitários (test/scripts/coverage-summary.spec.ts). O porquê:
// docs/reference/testes.md#cobertura.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/** O piso de `domain/` e `application/`: o `coverage.thresholds` do vitest.config.ts o importa daqui. */
export const COVERAGE_FLOOR = 90;

const LAYERS = ['domain', 'application', 'contracts'];
const OTHER = 'infra e o resto';
const METRICS = ['lines', 'statements', 'branches', 'functions'];

/** A camada de um arquivo pelo segmento do caminho; o que não está numa camada (o `catalog`, a infra) cai no resto. */
function layerOf(file, root) {
  const segments = path.relative(root, file).split(path.sep);
  return LAYERS.find((layer) => segments.includes(layer)) ?? OTHER;
}

/** Porcentagem com uma casa, ou "—" sem nada a medir. */
function percent({ covered, total }) {
  return total === 0 ? '—' : `${((100 * covered) / total).toFixed(1).replace('.', ',')}%`;
}

const row = (name, metrics, files) =>
  `| ${name} | ${METRICS.map((m) => percent(metrics[m])).join(' | ')} | ${files} |`;

/**
 * O Markdown do resumo: uma linha por camada, com `covered` e `total` somados por camada (e não a média das
 * porcentagens dos arquivos), e o total do próprio JSON. `summary` é o conteúdo do coverage-summary.json, com os
 * caminhos absolutos; `root` é a raiz do repositório.
 */
export function coverageSummary(summary, root) {
  const groups = new Map(
    [...LAYERS, OTHER].map((name) => [
      name,
      { files: 0, ...Object.fromEntries(METRICS.map((m) => [m, { covered: 0, total: 0 }])) },
    ]),
  );
  for (const [file, metrics] of Object.entries(summary)) {
    if (file === 'total') continue;
    const group = groups.get(layerOf(file, root));
    group.files += 1;
    for (const m of METRICS) {
      group[m].covered += metrics[m].covered;
      group[m].total += metrics[m].total;
    }
  }
  return [
    '### Cobertura dos unitários',
    '',
    '| Camada | Linhas | Statements | Branches | Funções | Arquivos |',
    '| --- | --- | --- | --- | --- | --- |',
    ...[...groups].map(([name, group]) => row(name, group, group.files)),
    row('**Total**', summary.total, Object.keys(summary).length - 1),
    '',
    `Piso de ${COVERAGE_FLOOR}% nas quatro métricas em \`domain/\` e \`application/\`, sem meta global.`,
    '',
    'Só os unitários são medidos: a infra é coberta pela integração e pelo e2e (docs/reference/testes.md#cobertura).',
    '',
  ].join('\n');
}

if (import.meta.main) {
  const file = path.resolve('coverage/coverage-summary.json');
  if (!existsSync(file)) {
    process.stderr.write(
      `coverage-summary: ${file} não existe; rode npm run test:coverage antes.\n`,
    );
    process.exit(1);
  }
  process.stdout.write(coverageSummary(JSON.parse(readFileSync(file, 'utf8')), process.cwd()));
}
