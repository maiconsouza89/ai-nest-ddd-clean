// Importe este arquivo ANTES do app.module: o ConfigModule lê o ambiente na hora do import.
process.env.OUTBOX_WORKER_ENABLED = 'true';
process.env.QUEUE_WORKERS_ENABLED = 'true';
