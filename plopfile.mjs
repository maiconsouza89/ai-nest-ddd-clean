import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const MODULES_DIR = 'src/modules';
const TEMPLATES = 'plop-templates/module';

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
  ['filter.hbs', 'infra/http/filters/domain-error.filter.ts'],
  ['in-memory.repository.hbs', 'infra/database/in-memory/in-memory-{{kebabCase name}}.repository.ts'],
  ['orm-entity.hbs', 'infra/database/typeorm/entities/{{kebabCase name}}.orm-entity.ts'],
  ['mapper.hbs', 'infra/database/typeorm/typeorm-{{kebabCase name}}.mapper.ts'],
  ['typeorm.repository.hbs', 'infra/database/typeorm/typeorm-{{kebabCase name}}.repository.ts'],
  ['data-source.hbs', 'infra/database/typeorm/{{kebabCase name}}.data-source.ts'],
  ['migration-schema.hbs', 'infra/database/typeorm/migrations/{{timestamp}}-create-{{kebabCase name}}-schema.ts'],
  ['migration-table.hbs', 'infra/database/typeorm/migrations/{{timestamp2}}-create-{{kebabCase name}}-table.ts'],
];

export default function (plop) {
  plop.setGenerator('module', {
    description: 'Novo módulo (domain, application, infra, migrations) no padrão do orders',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Nome do módulo, no singular (ex.: billing, shipment)',
        validate: (v) =>
          /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(v) || 'Use kebab-case minúsculo, começando por letra (ex.: shipment, price-list)',
      },
    ],
    actions: (data) => {
      const kebab = plop.getHelper('kebabCase')(data.name);
      const pascal = plop.getHelper('pascalCase')(data.name);
      const dir = `${MODULES_DIR}/${kebab}`;
      if (existsSync(dir)) throw new Error(`${dir} já existe`);

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
        {
          type: 'modify',
          path: 'src/app.module.ts',
          pattern: /(\n@Module\()/,
          template: `import { ${pascal}Module } from './modules/${kebab}/infra/${kebab}.module';\n$1`,
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
          if (!src.includes(`    ${pascal}Module,`) || !src.includes(`import { ${pascal}Module }`)) {
            throw new Error(`${pascal}Module não foi registrado em src/app.module.ts: adicione à mão`);
          }
          return 'módulo registrado em app.module.ts';
        },
        () => {
          const file = 'package.json';
          const pkg = JSON.parse(readFileSync(file, 'utf8'));
          const ds = `${dir}/infra/database/typeorm/${kebab}.data-source.ts`;
          const migDir = `${dir}/infra/database/typeorm/migrations`;
          pkg.scripts[`mig:${kebab}:gen`] = `typeorm-ts-node-commonjs migration:generate ${migDir}/change -d ${ds}`;
          pkg.scripts[`mig:${kebab}:run`] = `typeorm-ts-node-commonjs migration:run -d ${ds}`;
          writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
          return `scripts mig:${kebab}:gen e mig:${kebab}:run adicionados`;
        },
      ];
    },
  });
}
