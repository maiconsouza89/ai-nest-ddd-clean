/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
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
    tsPreCompilationDeps: 'specify',
    doNotFollow: { path: 'node_modules' },
  },
};
