// Plugin do remark com as regras da documentação que o markdownlint e o remark-validate-links não cobrem
// (ADR 0006). Roda no `npm run docs:check`, que falha em qualquer aviso (`--frail`).
import { existsSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';

const quadrantTypes = {
  tutorials: 'tutorial',
  'how-to': 'how-to',
  reference: 'reference',
  explanation: 'explanation',
};
const agentFiles = new Set(['AGENTS.md', 'CLAUDE.md', 'CLAUDE.local.md']);

// `@caminho` fora de código é import no Claude Code. Conta como caminho o que tem `/` ou extensão.
// O `(?<!\w)` deixa de fora e-mails (user@example.com).
const importPattern = /(?<!\w)@([\w.~/-]+)/g;
// Caminho de `docs/` citado em texto ou entre crases, a partir da raiz (`docs/...`) ou relativo ao arquivo
// (`./docs/...`, `../docs/...`). Placeholders (`<módulo>`, `{a,b}`, `*`) são pulados.
const pointerPattern = /(?<![\w./@-])(?:\.{1,2}\/)*docs\/[^\s`'"()[\]]*/g;
const trailingPunctuation = /[.,:;!?…]+$/;
// `docs/x.md#secao` e `docs/x.md:12` apontam para um arquivo que existe; a âncora e a linha saem.
const toFilePath = (pointer) =>
  pointer
    .split('#')[0]
    .replace(trailingPunctuation, '')
    .replace(/:\d+(:\d+)?$/, '');

function visit(node, types, callback) {
  if (types.includes(node.type)) callback(node);
  for (const child of node.children ?? []) visit(child, types, callback);
}

export default function remarkDocsRules() {
  return (tree, file) => {
    const path = relative(file.cwd, resolve(file.cwd, file.path)).split(sep).join('/');
    const name = basename(path);
    const isAgentFile = agentFiles.has(name);
    const fail = (reason, node, ruleId) =>
      file.message(reason, { place: node.position, ruleId, source: 'docs-rules' });

    const folder = /^docs\/([^/]+)\//.exec(path)?.[1];
    const expectedType = Object.hasOwn(quadrantTypes, folder) ? quadrantTypes[folder] : undefined;
    if (expectedType) {
      const frontmatter = tree.children[0]?.type === 'yaml' ? tree.children[0] : undefined;
      const type =
        frontmatter && /^type:\s*(["']?)([\w-]+)\1\s*(?:#.*)?$/m.exec(frontmatter.value)?.[2];
      if (type !== expectedType) {
        const actual = type ? `\`type: ${type}\`` : 'nenhum `type:` no frontmatter';
        fail(
          `Página em docs/${folder}/ com ${actual}. Use \`type: ${expectedType}\` ou mova a página.`,
          frontmatter ?? tree,
          'quadrant-type',
        );
      }
    }

    if (isAgentFile) {
      visit(tree, ['text'], (node) => {
        for (const [, match] of node.value.matchAll(importPattern)) {
          const target = match.replace(trailingPunctuation, '');
          if (!/[/.]/.test(target)) continue;
          if (name.startsWith('CLAUDE') && target === 'AGENTS.md') continue;
          fail(
            `\`@${target}\` importa o arquivo em toda sessão. Cite o caminho entre crases, sem \`@\`.`,
            node,
            'agent-import',
          );
        }
      });
    }

    // Os arquivos de agente apontam para `docs/` em texto simples, que o remark-validate-links não vê.
    if (isAgentFile || /(^|\/)\.claude\//.test(path)) {
      visit(tree, ['text', 'inlineCode'], (node) => {
        for (const [match] of node.value.matchAll(pointerPattern)) {
          if (/[<>{}*]/.test(match)) continue;
          const pointer = toFilePath(match);
          const base = pointer.startsWith('.') ? dirname(resolve(file.cwd, path)) : file.cwd;
          if (!existsSync(resolve(base, pointer))) {
            fail(`\`${pointer}\` não existe.`, node, 'agent-pointer');
          }
        }
      });
    }
  };
}
