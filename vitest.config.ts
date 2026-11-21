import { defineConfig } from 'vitest/config';

export default defineConfig({
  // O oxc, transformador padrão do Vite 8, emite a decorator metadata que o Nest usa para injetar
  // por classe. experimentalDecorators e emitDecoratorMetadata vêm do tsconfig.json.
  test: {
    setupFiles: ['./test/setup-env.ts'],
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
