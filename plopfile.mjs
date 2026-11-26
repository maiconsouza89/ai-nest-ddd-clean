import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { quadrantTypes } from './scripts/remark-docs-rules.mjs';

const MODULES_DIR = 'src/modules';
const TEMPLATES = 'plop-templates/module';
const DOCS_INDEX = 'docs/README.md';
// `@app/source` resolve os aliases `#shared/*` para `src` quando o ts-node carrega o data source
const TYPEORM_CLI = 'NODE_OPTIONS=--conditions=@app/source typeorm-ts-node-esm';

// [template, destino relativo à pasta do módulo]
const FILES = [
  ['entity.hbs', 'domain/entities/{{kebabCase name}}.entity.ts'],
  ['not-found.error.hbs', 'domain/errors/{{kebabCase name}}-not-found.error.ts'],
  ['repository.hbs', 'domain/repositories/{{kebabCase name}}.repository.ts'],
  ['create.input.hbs', 'application/dtos/create-{{kebabCase name}}.input.ts'],
  ['create.use-case.hbs', 'application/use-cases/create-{{kebabCase name}}.use-case.ts'],
  ['get.use-case.hbs', 'application/use-cases/get-{{kebabCase name}}.use-case.ts'],
  ['create.use-case.spec.hbs', 'application/use-cases/create-{{kebabCase name}}.use-case.spec.ts'],
  ['module.hbs', 'infra/{{kebabCase name}}.module.ts'],
  ['controller.hbs', 'infra/http/controllers/{{kebabCase name}}.controller.ts'],
  ['request.hbs', 'infra/http/dtos/create-{{kebabCase name}}.request.ts'],
  ['response.hbs', 'infra/http/dtos/{{kebabCase name}}.responses.ts'],
  ['error-statuses.hbs', 'infra/http/error-statuses.ts'],
  [
    'in-memory.repository.hbs',
    'infra/database/in-memory/in-memory-{{kebabCase name}}.repository.ts',
  ],
  ['orm-entity.hbs', 'infra/database/typeorm/entities/{{kebabCase name}}.orm-entity.ts'],
  ['mapper.hbs', 'infra/database/typeorm/typeorm-{{kebabCase name}}.mapper.ts'],
  ['typeorm.repository.hbs', 'infra/database/typeorm/typeorm-{{kebabCase name}}.repository.ts'],
  [
    'typeorm.repository.int-spec.hbs',
    'infra/database/typeorm/typeorm-{{kebabCase name}}.repository.int-spec.ts',
  ],
  ['data-source.hbs', 'infra/database/typeorm/{{kebabCase name}}.data-source.ts'],
  [
    'migration-schema.hbs',
    'infra/database/typeorm/migrations/{{timestamp}}-create-{{kebabCase name}}-schema.ts',
  ],
  [
    'migration-table.hbs',
    'infra/database/typeorm/migrations/{{timestamp2}}-create-{{kebabCase name}}-table.ts',
  ],
];

// Quadrantes do Diátaxis (ADR 0006): tipo da página → pasta em docs/, a partir do mapa que o docs:check usa
const DOC_FOLDERS = Object.fromEntries(
  Object.entries(quadrantTypes).map(([folder, type]) => [type, folder]),
);

// "Variáveis de ambiente" → "variaveis-de-ambiente": nome de arquivo sem acento
const slugify = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Nome da página sem espaços nas pontas. O how-to se chama "Como <tarefa>", e o "como" digitado sai daqui.
const docStem = ({ type, name }) =>
  type === 'how-to' ? name.trim().replace(/^como(?:[\s:,-]+|$)/i, '') : name.trim();

export default function (plop) {
  plop.setGenerator('doc', {
    description: 'Nova página de docs/ (tutorial, how-to, reference ou explanation)',
    prompts: [
      {
        type: 'list',
        name: 'type',
        message: 'Tipo da página',
        choices: Object.keys(DOC_FOLDERS),
      },
      {
        type: 'input',
        name: 'name',
        message:
          'Nome da página, em pt-BR (ex.: variáveis de ambiente). No how-to, comece pelo verbo: rodar as migrations',
        validate: (name, { type }) =>
          slugify(docStem({ type, name })) !== '' || 'Informe um nome com letras ou números',
      },
    ],
    actions: (data) => {
      const isHowTo = data.type === 'how-to';
      const stem = docStem(data);
      // O validate não conhece o tipo quando ele é escolhido depois (`plop doc _ como`)
      if (slugify(stem) === '') throw new Error(`Nome sem letras ou números: "${data.name}"`);
      // "Rodar…" vira "Como rodar…", mas uma sigla ("API…") fica como está
      const title = isHowTo
        ? `Como ${stem.replace(/^\p{Lu}(?=\p{Ll})/u, (c) => c.toLowerCase())}`
        : `${stem.charAt(0).toUpperCase()}${stem.slice(1)}`;
      return [
        {
          type: 'add',
          path: `docs/${DOC_FOLDERS[data.type]}/${slugify(stem)}.md`,
          templateFile: `plop-templates/doc/${data.type}.md.hbs`,
          data: { title },
        },
      ];
    },
  });

  plop.setGenerator('module', {
    description: 'Novo módulo com todas as camadas (domain, application, infra, migrations)',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Nome do módulo, no singular (ex.: billing, shipment)',
        validate: (v) =>
          /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(v) ||
          'Use kebab-case minúsculo, começando por letra (ex.: shipment, price-list)',
      },
    ],
    actions: (data) => {
      const kebab = plop.getHelper('kebabCase')(data.name);
      const pascal = plop.getHelper('pascalCase')(data.name);
      const dir = `${MODULES_DIR}/${kebab}`;
      const doc = `docs/reference/modules/${kebab}.md`;
      const testDb = `test/helpers/${kebab}-database.ts`;
      for (const path of [dir, doc, testDb]) {
        if (existsSync(path)) throw new Error(`${path} já existe`);
      }

      // timestamps das migrations: o do schema vem antes do da tabela
      data.timestamp = Date.now();
      data.timestamp2 = data.timestamp + 1;

      const add = FILES.map(([template, dest]) => ({
        type: 'add',
        path: `${dir}/${dest}`,
        templateFile: `${TEMPLATES}/${template}`,
      }));

      return [
        ...add,
        // entidades e migrations do módulo para os testes de integração, que não leem a pasta de migrations
        { type: 'add', path: testDb, templateFile: `${TEMPLATES}/test-database.hbs` },
        // a doc do módulo nasce com ele (ADR 0006) e falha no docs:check até os comentários saírem
        { type: 'add', path: doc, templateFile: 'plop-templates/doc/module.md.hbs' },
        // o docs:check exige cada módulo no índice: entra no fim da lista "Módulos"
        {
          type: 'modify',
          path: DOCS_INDEX,
          pattern: /(\n### Módulos\n\n[^\n]*\n\n(?:- [^\n]*\n)*)/,
          template: `$1- [${kebab}](reference/modules/${kebab}.md)\n`,
        },
        {
          type: 'modify',
          path: 'src/app.module.ts',
          pattern: /(\n@Module\()/,
          template: `import { ${pascal}Module } from '#modules/${kebab}/infra/${kebab}.module';\n$1`,
        },
        {
          type: 'modify',
          path: 'src/app.module.ts',
          pattern: /(\n {2}\],\n {2}providers:)/,
          template: `\n    ${pascal}Module,$1`,
        },
        // o modify do plop não avisa quando o padrão não casa: confirma que o módulo ficou registrado
        () => {
          const src = readFileSync('src/app.module.ts', 'utf8');
          if (
            !src.includes(`    ${pascal}Module,`) ||
            !src.includes(`import { ${pascal}Module }`)
          ) {
            throw new Error(
              `${pascal}Module não foi registrado em src/app.module.ts: adicione à mão`,
            );
          }
          return 'módulo registrado em app.module.ts';
        },
        () => {
          const file = 'package.json';
          const pkg = JSON.parse(readFileSync(file, 'utf8'));
          const ds = `${dir}/infra/database/typeorm/${kebab}.data-source.ts`;
          const migDir = `${dir}/infra/database/typeorm/migrations`;
          pkg.scripts[`mig:${kebab}:gen`] =
            `${TYPEORM_CLI} migration:generate ${migDir}/change -d ${ds}`;
          pkg.scripts[`mig:${kebab}:run`] = `${TYPEORM_CLI} migration:run -d ${ds}`;
          // em produção não há ts-node: o data source compilado, sem `@app/source`, para os aliases caírem no dist/
          const distDs = ds.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js');
          pkg.scripts[`mig:${kebab}:run:prod`] = `typeorm migration:run -d ${distDs}`;
          writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
          return `scripts mig:${kebab}:gen, mig:${kebab}:run e mig:${kebab}:run:prod adicionados`;
        },
        // por último: um índice fora do padrão não impede o registro do módulo nem os scripts de migration
        () => {
          if (!readFileSync(DOCS_INDEX, 'utf8').includes(`(reference/modules/${kebab}.md)`)) {
            throw new Error(`${kebab} não entrou no índice de ${DOCS_INDEX}: adicione à mão`);
          }
          return `${kebab} no índice de ${DOCS_INDEX}: escreva a descrição de uma linha`;
        },
      ];
    },
  });
}
