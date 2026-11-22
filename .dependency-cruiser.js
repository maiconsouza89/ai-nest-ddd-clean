/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      // imports só de tipo (import type) somem na compilação e não formam ciclo real
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
    },
    {
      name: 'domain-e-application-sem-framework',
      severity: 'error',
      from: { path: '/(domain|application)/' },
      to: { path: 'node_modules/(@nestjs|typeorm)' },
    },
    {
      name: 'domain-nao-conhece-camadas-externas',
      severity: 'error',
      from: { path: '/domain/' },
      to: { path: '/(application|infra)/' },
    },
    {
      name: 'application-nao-conhece-infra',
      severity: 'error',
      from: { path: '/application/' },
      to: { path: '/infra/' },
    },
    {
      name: 'contracts-sem-domain-e-infra',
      severity: 'error',
      from: { path: '/contracts/' },
      to: { path: '/(domain|infra)/' },
    },
    {
      // Convenção do ADR 0005: sair do módulo (ou do shared) é sempre por alias, nunca por `../`.
      name: 'fronteira-via-alias',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+|shared)/' },
      to: {
        path: '^src/',
        pathNot: '^src/$1/',
        // o import por alias também carrega o tipo `local`, então ele precisa ser excluído aqui
        dependencyTypesNot: ['aliased-subpath-import'],
      },
    },
    {
      // Dentro da mesma fronteira o import continua relativo (ADR 0005).
      name: 'alias-so-entre-fronteiras',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+|shared)/' },
      to: { path: '^src/$1/', dependencyTypes: ['aliased-subpath-import'] },
    },
    {
      name: 'modulos-so-via-contracts',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/contracts/'],
      },
    },
  ],
  options: {
    // Testes podem montar peças de várias camadas.
    exclude: { path: '\\.(spec|int-spec|e2e-spec)\\.ts$' },
    tsConfig: { fileName: 'tsconfig.json' },
    // Sem `@app/source`, os aliases `#shared/*` e afins resolvem para `dist`, e as regras de camada
    // deixam de enxergar o import (ADR 0005).
    enhancedResolveOptions: { conditionNames: ['@app/source', 'import', 'node', 'default'] },
    tsPreCompilationDeps: 'specify',
    doNotFollow: { path: 'node_modules' },
  },
};
