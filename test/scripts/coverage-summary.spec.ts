import { describe, expect, it } from 'vitest';
import { coverageSummary, type FileCoverage } from '../../scripts/coverage-summary.mjs';

const ROOT = '/repo';

const cov = (covered: number, total: number): FileCoverage => ({
  lines: { covered, total },
  statements: { covered, total },
  branches: { covered, total },
  functions: { covered, total },
});

const summary: Record<string, FileCoverage> = {
  total: cov(20, 40),
  '/repo/src/modules/orders/domain/order.entity.ts': cov(9, 10),
  '/repo/src/modules/orders/domain/money.vo.ts': cov(1, 30),
  '/repo/src/modules/orders/application/create-order.use-case.ts': cov(0, 0),
  '/repo/src/modules/orders/contracts/orders.facade.ts': cov(0, 0),
  '/repo/src/modules/catalog/catalog.service.ts': cov(10, 10),
};

/** As células da linha da tabela que começa com `name`. */
const cells = (markdown: string, name: string) =>
  markdown
    .split('\n')
    .find((line) => line.startsWith(`| ${name} |`))
    ?.split('|')
    .slice(2, -1)
    .map((cell) => cell.trim());

describe('coverageSummary', () => {
  const markdown = coverageSummary(summary, ROOT);

  it('soma covered e total por camada, sem fazer média das porcentagens dos arquivos', () => {
    // (9 + 1) / (10 + 30) = 25%, e não a média de 90% e 3,3%
    expect(cells(markdown, 'domain')).toEqual(['25,0%', '25,0%', '25,0%', '25,0%', '2']);
  });

  it('mostra "—" numa camada sem nada a medir', () => {
    expect(cells(markdown, 'application')).toEqual(['—', '—', '—', '—', '1']);
    expect(cells(markdown, 'contracts')).toEqual(['—', '—', '—', '—', '1']);
  });

  it('põe um arquivo fora das camadas, como os do catalog, em infra e o resto', () => {
    expect(cells(markdown, 'infra e o resto')).toEqual([
      '100,0%',
      '100,0%',
      '100,0%',
      '100,0%',
      '1',
    ]);
  });

  it('usa o total do JSON e conta todos os arquivos', () => {
    expect(cells(markdown, '**Total**')).toEqual(['50,0%', '50,0%', '50,0%', '50,0%', '5']);
  });

  it('trunca a porcentagem, para um valor abaixo do piso não aparecer como 90,0%', () => {
    const below = coverageSummary(
      { total: cov(8996, 10_000), '/repo/src/a/domain/a.ts': cov(8996, 10_000) },
      ROOT,
    );
    expect(cells(below, 'domain')?.[0]).toBe('89,9%');
  });

  it('diz o piso e o que é medido', () => {
    expect(markdown).toContain('Piso de 90%');
    expect(markdown).toContain('docs/reference/testes.md#cobertura');
  });
});
