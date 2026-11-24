import { config } from 'dotenv';

const ENV_FILES = ['.env.local', '.env'];

/**
 * Carrega os arquivos .env para quem roda fora do Nest (tracing.ts e CLI de migrations), com a mesma
 * regra do ConfigModule do app.module.ts: fora de produção, lê o `.env.local` e o `.env`, e a primeira
 * definição vence, inclusive a que já está no ambiente. Com NODE_ENV=production, não lê arquivo nenhum.
 */
export function loadEnvFiles(processEnv: NodeJS.ProcessEnv = process.env, paths = ENV_FILES): void {
  if (processEnv.NODE_ENV === 'production') return;
  config({ path: paths, quiet: true, processEnv });
}
