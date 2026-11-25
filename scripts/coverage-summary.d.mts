// Tipos de scripts/coverage-summary.mjs, para os unitários em TypeScript.
export interface CoverageMetric {
  total: number;
  covered: number;
}

export type FileCoverage = Record<
  'lines' | 'statements' | 'branches' | 'functions',
  CoverageMetric
>;

export declare function coverageSummary(
  summary: Record<string, FileCoverage>,
  root: string,
): string;
