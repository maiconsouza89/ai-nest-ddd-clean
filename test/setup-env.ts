import 'reflect-metadata';

// Variáveis mínimas para os testes que sobem o AppModule (validadas por validateEnv).
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/app';
// o worker da outbox não roda nos testes que sobem o app; os testes dele o chamam direto
process.env.OUTBOX_WORKER_ENABLED ??= 'false';
process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-0123';
// os e2e fazem muitos logins do mesmo IP; o teste de rate limit liga o throttler por conta própria
process.env.THROTTLE_ENABLED ??= 'false';
process.env.LOG_LEVEL ??= 'silent';
process.env.OTEL_SDK_DISABLED ??= 'true';
// os jobs agendados não disparam nos testes que sobem o app; os testes os chamam direto
process.env.JOBS_ENABLED ??= 'false';
