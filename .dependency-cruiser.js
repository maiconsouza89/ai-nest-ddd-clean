// Cada regra traz no `comment` o que ela barra e como consertar. O `npm run arch` usa a saída `err-long`,
// que imprime esse comentário junto com a violação. O que exige julgamento fica em docs/reference/camadas.md.
const CAMADAS = 'docs/reference/camadas.md';
const CONVENCOES = 'docs/reference/convencoes.md';

/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
const rules = [
  {
    name: 'no-circular',
    comment:
      'Ciclo de imports. Entre módulos, uma direção pode ser síncrona (facade) e a volta é por evento. ' +
      'Um `import type` não forma ciclo.',
    from: {},
    to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
  },
  {
    name: 'camadas-internas-sem-pacotes',
    comment:
      'domain, application e contracts são TypeScript puro: não importam pacote npm nem módulo do Node ' +
      '(Nest, TypeORM, class-validator, crypto...). Declare um port (abstract class) na application e ' +
      'implemente na infra. Para liberar um pacote puro, sem I/O nem framework, acrescente um `pathNot` ' +
      `no \`to\` desta regra. Ver ${CAMADAS}.`,
    from: { path: '/(domain|application|contracts)/' },
    // Todo import resolvido dentro de src/, por caminho ou por alias, tem o tipo `local`.
    to: { dependencyTypesNot: ['local'] },
  },
  {
    name: 'domain-nao-conhece-camadas-externas',
    comment: `O domain não importa application nem infra: as dependências apontam para dentro. Ver ${CAMADAS}.`,
    from: { path: '/domain/' },
    to: { path: '/(application|infra)/' },
  },
  {
    name: 'application-nao-conhece-infra',
    comment:
      'A application não importa a infra. Declare um port (abstract class) em application/ports, ' +
      `implemente na infra e ligue no módulo Nest. Ver ${CAMADAS}.`,
    from: { path: '/application/' },
    to: { path: '/infra/' },
  },
  {
    name: 'contracts-sem-domain-e-infra',
    comment:
      'O contracts é a API pública do módulo: tipos com primitivos, sem entidade nem erro de domínio. ' +
      `Ver ${CAMADAS}.`,
    from: { path: '/contracts/' },
    to: { path: '/(domain|infra)/' },
  },
  {
    name: 'porta-de-entrada-sem-persistencia',
    comment:
      'Controller, job e handler de evento só convertem a entrada e chamam um caso de uso ou uma query. ' +
      `Não usam repositório, persistência (do módulo ou do shared) nem TypeORM. Ver ${CAMADAS}.`,
    from: { path: '^src/modules/[^/]+/infra/(http|jobs|events)/' },
    to: { path: ['/(domain/repositories|infra/database)/', '^node_modules/(@nestjs/)?typeorm/'] },
  },
  {
    name: 'shared-nao-importa-modulos',
    comment:
      'O shared não conhece os módulos, nem por alias. Um port do shared é ligado à implementação num ' +
      'Nest module do módulo dono (o IdentityAuthModule), que o AppModule só repassa para o ' +
      `AuthModule.forRoot (ADR 0002). Ver ${CAMADAS}.`,
    from: { path: '^src/shared/' },
    to: { path: '^src/modules/' },
  },
  {
    name: 'fronteira-via-alias',
    comment:
      'Saindo do módulo ou do shared, use o alias (`#shared/*`, `#modules/*`), não `../`. ' +
      `Ver ${CONVENCOES} (ADR 0005).`,
    from: { path: '^src/(modules/[^/]+|shared)/' },
    to: {
      path: '^src/',
      pathNot: '^src/$1/',
      // o import por alias também carrega o tipo `local`, então ele precisa ser excluído aqui
      dependencyTypesNot: ['aliased-subpath-import'],
    },
  },
  {
    name: 'alias-so-entre-fronteiras',
    comment:
      'Dentro do mesmo módulo (ou do shared), o import é relativo e com `.js`. ' +
      `Ver ${CONVENCOES} (ADR 0005).`,
    from: { path: '^src/(modules/[^/]+|shared)/' },
    to: { path: '^src/$1/', dependencyTypes: ['aliased-subpath-import'] },
  },
  {
    name: 'shared-infra-so-pela-superficie',
    comment:
      'Um módulo só importa do `src/shared/infra/` os arquivos da superfície pública (o `pathNot` desta ' +
      'regra): decorators, helpers e as peças que o código do módulo usa direto. Um `*.module.ts` ou um ' +
      'adapter do shared entra pelo Nest (`@Global` ou `imports`), e não por import de arquivo: injete o ' +
      'port. Acrescentar um arquivo à lista pede o ok na revisão do PR. ' +
      `Ver ${CAMADAS}#superfície-pública-da-infra.`,
    from: { path: '^src/modules/' },
    to: {
      path: '^src/shared/infra/',
      pathNot: [
        'auth/current-user\\.decorator',
        'auth/public\\.decorator',
        'auth/roles\\.decorator',
        'config/env\\.validation',
        'config/load-env-files',
        'database/postgres-options',
        'database/run-seed',
        'database/transaction-context',
        'http/error-status\\.registry',
        'http/page\\.response',
        'http/pagination\\.query',
        'http/problem-details\\.response',
        'http/rate-limit/throttle-by-account\\.decorator',
        'http/trim\\.decorator',
        'jobs/scheduled-job\\.processor',
        'messaging/integration-event-handler\\.decorator',
        'redis/queue-redis\\.connection',
        'resilience/retry',
        'resilience/with-timeout',
      ].map((file) => `^src/shared/infra/${file}\\.ts$`),
    },
  },
  {
    name: 'modulos-so-via-contracts',
    comment:
      'De outro módulo, importe só o `contracts/` (facade ou evento). ' +
      'Ver docs/reference/modules/ e o ADR 0003.',
    from: { path: '^src/modules/([^/]+)/', pathNot: '\\.module\\.ts$' },
    to: {
      path: '^src/modules/[^/]+/',
      pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/contracts/'],
    },
  },
  {
    name: 'modulo-nest-so-importa-modulo-nest',
    comment:
      'O arquivo do módulo Nest só importa, de outro módulo, o `contracts/` ou o módulo Nest dele, para ' +
      'declarar a dependência em `imports` (ADR 0003).',
    from: { path: '^src/modules/([^/]+)/.+\\.module\\.ts$' },
    to: {
      path: '^src/modules/[^/]+/',
      pathNot: [
        '^src/modules/$1/',
        '^src/modules/[^/]+/contracts/',
        '^src/modules/[^/]+/(infra/)?[^/]+\\.module\\.ts$',
      ],
    },
  },
];

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  // O padrão do dependency-cruiser é `warn`, com que o `arch` passa mesmo com a violação. Aqui toda regra
  // é `error`, salvo se declarar outra `severity` de propósito.
  forbidden: rules.map((rule) => ({ severity: 'error', ...rule })),
  options: {
    // Testes podem montar peças de várias camadas.
    exclude: { path: '\\.(spec|int-spec|e2e-spec)\\.ts$' },
    tsConfig: { fileName: 'tsconfig.json' },
    // Sem `@app/source`, os aliases `#shared/*` e afins resolvem para `dist`, e as regras de camada
    // deixam de enxergar o import (ADR 0005).
    enhancedResolveOptions: { conditionNames: ['@app/source', 'import', 'node', 'default'] },
    // Inclui os `import type`, que somem na compilação: sem isto, um `import type` da infra no domain
    // passaria. Eles ganham o rótulo `type-only`, que a `no-circular` ignora.
    tsPreCompilationDeps: 'specify',
    doNotFollow: { path: 'node_modules' },
  },
};
