// Carregado pelo main.ts antes do app: a auto-instrumentação só enxerga módulos carregados depois
// dela. O exporter vem das variáveis padrão do OpenTelemetry
// (OTEL_TRACES_EXPORTER=otlp|console|none, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME).
// Mantenha os imports daqui mínimos: tudo o que for importado neste arquivo carrega antes do hook ESM
// e não é instrumentado.
import { register } from 'node:module';
import { config as loadEnvFile } from 'dotenv';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { isHealthRequest } from '#shared/infra/observability/ignored-paths';
import { registerTracingShutdown } from '#shared/infra/observability/tracing-lifecycle';

// Este arquivo roda antes do ConfigModule: sem isto, OTEL_* escritas no .env seriam ignoradas.
// Mesma ordem e mesma regra do ConfigModule (a primeira definição vence; produção só usa o ambiente).
if (process.env.NODE_ENV !== 'production') {
  loadEnvFile({ path: ['.env.local', '.env'], quiet: true });
}

if (process.env.OTEL_SDK_DISABLED !== 'true') {
  // Em ESM, o `require` não é interceptado: o hook do import-in-the-middle é o que permite instrumentar
  // o que o código importa direto (como o `ioredis`). Precisa vir antes de carregar o app.
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);
  const sdk = new NodeSDK({
    instrumentations: [
      getNodeAutoInstrumentations({
        // ruído sem valor: cada chamada de fs vira um span
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => isHealthRequest(req.url),
        },
      }),
    ],
  });
  sdk.start();
  // o Nest encerra a aplicação no SIGTERM; o flush dos spans é aguardado no hook de shutdown
  registerTracingShutdown(() => sdk.shutdown());
}
