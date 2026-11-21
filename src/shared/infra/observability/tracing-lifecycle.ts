import { Injectable, OnApplicationShutdown } from '@nestjs/common';

// Ponte entre o `tracing.ts` (que roda antes do Nest) e o ciclo de vida do Nest, sem que a
// aplicação precise importar o SDK do OpenTelemetry.
let shutdownHook: (() => Promise<void>) | undefined;

export const registerTracingShutdown = (hook: () => Promise<void>) => {
  shutdownHook = hook;
};

/** Espera o SDK exportar os spans pendentes antes de o processo encerrar. */
@Injectable()
export class TracingShutdown implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await shutdownHook?.();
  }
}
