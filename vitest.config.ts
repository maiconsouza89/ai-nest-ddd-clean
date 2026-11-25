import { configDefaults, defineConfig } from 'vitest/config';

// Ativa a condição `@app/source` dos aliases `#...` (ADR 0005). Não acrescente `import` nem `default`
// à lista: o `require('pg')` do TypeORM passaria a resolver o build ESM e falharia.
const conditions = ['@app/source', 'module', 'node', 'development|production'];

export default defineConfig({
  // Em todo ambiente do Node, não só no `ssr` dos arquivos de teste: o Vitest carrega o globalSetup no
  // processo principal, num ambiente próprio. Sem a condição nele, as migrations dos templates viriam do
  // dist/, sem erro. `resolve.conditions` na raiz não serve: o Vite a aplica só ao `client`.
  plugins: [
    {
      name: 'app-source-condition',
      configEnvironment(name, env) {
        if (name === 'client') return;
        env.resolve ??= {};
        env.resolve.conditions = conditions;
      },
    },
  ],
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
          // um Postgres (com um template migrado por módulo) e um Redis para a execução inteira
          globalSetup: ['./test/global-setup/int.ts'],
          // Os arquivos rodam em paralelo: cada um tem o próprio banco clonado e cada worker o seu banco
          // lógico no Redis. Um teste instável se corrige na espera dele, sem voltar ao modo serial.
          testTimeout: 60_000,
          hookTimeout: 30_000, // os containers sobem no globalSetup; só os dois arquivos com container próprio passam disso
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
