import { config } from 'dotenv';

/** Em ordem de precedência: a primeira definição vence, e o ambiente vence as duas. */
export const ENV_FILES = ['.env.local', '.env'];

/** Em produção, só o ambiente vale. */
export const ignoresEnvFiles = (processEnv: NodeJS.ProcessEnv = process.env) =>
  processEnv.NODE_ENV === 'production';

/**
 * Para quem roda fora do Nest (tracing.ts e CLI de migrations). O ConfigModule do app.module.ts usa
 * o mesmo ENV_FILES e o mesmo ignoresEnvFiles.
 */
export function loadEnvFiles(processEnv: NodeJS.ProcessEnv = process.env, paths = ENV_FILES): void {
  if (ignoresEnvFiles(processEnv)) return;
  config({ path: paths, quiet: true, processEnv });
}
