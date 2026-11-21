// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist', 'coverage', '**/migrations/**', 'plop-templates']),
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // Testes: `expect(repo.save)` passa o método solto de propósito, e supertest, matchers do Jest e
    // `ds.query` cru devolvem `any`. Em produção, as regras no-unsafe-* ficam ligadas. Ver ADR 0004.
    files: ['**/*.spec.ts', '**/*.int-spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
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
      '**/*.spec.ts',
      '**/*.int-spec.ts',
      'test/**/*.ts',
      '**/in-memory/**',
      '**/simulated-payment.gateway.ts',
      '**/logging-email-sender.ts',
    ],
    rules: { '@typescript-eslint/require-await': 'off' },
  },
  prettier,
);
