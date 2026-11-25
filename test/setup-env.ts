import 'reflect-metadata';
import { ignoresEnvFiles, loadEnvFiles } from '#shared/infra/config/load-env-files';

// Num worktree (`npm run worktree:setup`), os e2e usam o banco, o banco lógico do Redis e a tag do Mailpit
// do checkout: só estas chaves vêm do .env.local e do .env, na precedência da app, e o ambiente vence. O resto
// fica nos valores de teste abaixo, para o THROTTLE_ENABLED, o LOG_LEVEL e os workers do .env não vazarem.
const CONNECTION_KEYS = ['DATABASE_URL', 'REDIS_URL', 'SMTP_URL', 'MAILPIT_API_URL', 'MAILPIT_TAG'];
if (!ignoresEnvFiles()) {
  const fromFiles: NodeJS.ProcessEnv = {};
  loadEnvFiles(fromFiles);
  for (const key of CONNECTION_KEYS)
    if (fromFiles[key] !== undefined) process.env[key] ??= fromFiles[key];
}

// Variáveis mínimas para os testes que sobem o AppModule (validadas por validateEnv).
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/app';
process.env.REDIS_URL ??= 'redis://localhost:6379';
// o worker da outbox não roda nos testes que sobem o app; os testes dele o chamam direto
process.env.OUTBOX_WORKER_ENABLED ??= 'false';
// o Mailpit do docker-compose; os testes de integração sobem o próprio
process.env.SMTP_URL ??= 'smtp://127.0.0.1:1025';
process.env.EMAIL_FROM ??= 'no-reply@example.com';
process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-0123';
// os e2e fazem muitos logins do mesmo IP; o teste de rate limit liga o throttler por conta própria
process.env.THROTTLE_ENABLED ??= 'false';
process.env.LOG_LEVEL ??= 'silent';
process.env.OTEL_SDK_DISABLED ??= 'true';
// os workers das filas de eventos também não; os e2e que importam enable-outbox-worker ligam os dois
process.env.QUEUE_WORKERS_ENABLED ??= 'false';
// os jobs agendados não disparam nos testes que sobem o app; os testes os chamam direto
process.env.JOBS_ENABLED ??= 'false';
