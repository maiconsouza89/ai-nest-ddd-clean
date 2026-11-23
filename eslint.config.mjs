// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

const testFiles = ['**/*.spec.ts', '**/*.int-spec.ts', 'test/**/*.ts'];

export default defineConfig(
  globalIgnores(['dist', 'coverage', '**/migrations/**', 'plop-templates']),
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    // Regras do strictTypeChecked adotadas uma a uma. As que ficaram de fora estão na ADR 0004.
    rules: {
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-misused-spread': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
    },
  },
  {
    // Testes: supertest, matchers do Vitest e `ds.query` cru devolvem `any`, e o `?.` do `afterAll` e o `!`
    // depois de um `findById` são intencionais. Em produção, essas regras ficam ligadas. Ver ADR 0004.
    files: testFiles,
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    // Fakes, repositórios em memória e adaptadores simulados implementam portas assíncronas. Ver ADR 0004.
    files: [
      ...testFiles,
      '**/in-memory/**',
      '**/simulated-payment.gateway.ts',
      '**/logging-email-sender.ts',
    ],
    rules: { '@typescript-eslint/require-await': 'off' },
  },
  {
    // O app só pode ser carregado depois do tracing, por `import()` dinâmico. Um import estático seria
    // resolvido antes do hook ESM do OpenTelemetry, e os spans do ioredis e do express sumiriam sem erro.
    files: ['src/main.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./*', '../*', '#*', '!./tracing.js'],
              message:
                'No main.ts, só o tracing é import estático. Carregue o app com await import().',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
