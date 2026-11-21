import type { DataSource } from 'typeorm';

// Executor comum dos seeds por módulo: só roda em development/test, abre a conexão, roda e fecha.
// Nunca rejeita: em caso de falha loga e marca o exit code.
export async function runSeed(
  dataSource: DataSource,
  seed: (ds: DataSource) => Promise<void>,
): Promise<void> {
  try {
    // lista de permitidos: NODE_ENV ausente ou desconhecido (staging, etc.) também recusa
    if (!['development', 'test'].includes(process.env.NODE_ENV ?? '')) {
      throw new Error('Seeds de desenvolvimento só rodam com NODE_ENV=development ou test.');
    }
    await dataSource.initialize();
    await seed(dataSource);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}
