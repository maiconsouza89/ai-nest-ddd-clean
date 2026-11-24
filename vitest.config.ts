import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  // Ativa a condição `@app/source` dos aliases `#...` (ADR 0005). Não acrescente `import` nem `default`
  // à lista: o `require('pg')` do TypeORM passaria a resolver o build ESM e falharia.
  ssr: { resolve: { conditions: ['@app/source', 'module', 'node', 'development|production'] } },
  // O oxc, transformador padrão do Vite 8, emite a decorator metadata que o Nest usa para injetar
  // por classe. experimentalDecorators e emitDecoratorMetadata vêm do tsconfig.json.
  test: {
    setupFiles: ['./test/setup-env.ts'],
    // Com `--changed`, uma mudança num destes arquivos roda a suíte inteira: o grafo de imports não os
    // enxerga. Um arquivo novo carregado por glob ou por caminho entra aqui (docs/reference/testes.md).
    // Comece todo padrão por `**/`: o Vitest compara com o caminho absoluto, e `docker-compose.yml`
    // sozinho nunca casa.
    forceRerunTriggers: [
      ...configDefaults.forceRerunTriggers, // package.json e configs do Vitest e do Vite
      // dependências e compilação mudam o comportamento de tudo
      '**/package-lock.json',
      '**/tsconfig*.json',
      // os data sources carregam as migrations por glob
      '**/migrations/**',
      // ambiente que os testes e o CI usam (o setupFiles o Vitest já trata como gatilho)
      '**/.env.example',
      '**/docker-compose.yml',
      '**/.github/workflows/**',
    ],
    // Os projetos herdam o setupFiles da raiz por padrão desde o Vitest 5.
    projects: [
      { test: { name: 'unit', include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'] } },
      {
        test: {
          name: 'int',
          include: ['src/**/*.int-spec.ts'],
          fileParallelism: false, // cada arquivo sobe seus containers; em paralelo estouram os timeouts
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          fileParallelism: false, // grava no banco do docker-compose
          testTimeout: 30_000,
          hookTimeout: 30_000, // o beforeAll sobe o AppModule inteiro
        },
      },
    ],
  },
});
