// Regras das mensagens de commit: o hook commit-msg (lefthook.yml) e o título do PR (pr-title.yml). A lista
// de tipos espelha a de .github/CONTRIBUTING.md, seção "Commits e título do PR": uma mudança lá muda esta
// config no mesmo PR.

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'test', 'perf', 'build', 'ci', 'chore'],
    ],
    // um nome próprio abre o assunto com maiúscula (`ci: Dependabot …`)
    'subject-case': [0],
    // o corpo tem um parágrafo por linha
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    'header-max-length': [2, 'always', 100],
  },
  helpUrl:
    'https://github.com/maiconsouza89/ai-nest-ddd-clean/blob/main/.github/CONTRIBUTING.md#commits-e-título-do-pr',
};
