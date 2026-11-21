import 'reflect-metadata';

// Variáveis mínimas para os testes que sobem o AppModule (validadas por validateEnv).
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/app';
process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-0123';
