// Gera o openapi.json da raiz a partir do AppModule, sem subir o servidor: docs/reference/operacao.md#swagger.
// Roda sobre o dist/ (npm run openapi:generate), porque os schemas dos DTOs vêm do plugin da CLI do Nest.
// Com --check, só compara com o arquivo guardado e falha se ele estiver desatualizado.
import 'reflect-metadata';
import { readFile, writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { loadEnvFiles } from '#shared/infra/config/load-env-files';
import { createSwaggerDocument } from '#shared/infra/http/swagger.setup';
import { API_VERSIONING } from './app.setup.js';

const OUTPUT = 'openapi.json';

// O validateEnv do ConfigModule.forRoot roda no import do AppModule e exige as variáveis obrigatórias.
// O .env.example preenche só as que faltam, antes do import dinâmico. Os valores não chegam a ser usados.
loadEnvFiles(process.env, ['.env.example']);
const { AppModule } = await import('./app.module.js');

// No preview, o Nest monta o grafo de módulos sem chamar construtor, factory nem hook de provider: nada
// conecta no Postgres nem no Redis. O abortOnError: false troca o process.abort() por uma exceção.
const app = await NestFactory.create(AppModule, {
  preview: true,
  abortOnError: false,
  logger: false,
});
// o configureApp lê o ConfigService, que não existe no preview; só a versão na URL muda as rotas
app.enableVersioning(API_VERSIONING);

const document = createSwaggerDocument(app);
// Sem ordenar, as chaves seguem a ordem dos imports do AppModule, e reordenar um módulo mexeria no arquivo.
// Ordem por code unit, e não localeCompare: o arquivo sai igual em qualquer locale.
const sorted = <T>(record: Record<string, T>) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1)));
document.paths = sorted(document.paths);
if (document.components?.schemas) document.components.schemas = sorted(document.components.schemas);
const content = `${JSON.stringify(document, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const saved = await readFile(OUTPUT, 'utf8').catch(() => undefined);
  if (saved !== content) {
    console.error('openapi.json desatualizado: rode npm run openapi:generate e commite o arquivo');
    process.exitCode = 1;
  }
} else {
  await writeFile(OUTPUT, content);
}

await app.close();
