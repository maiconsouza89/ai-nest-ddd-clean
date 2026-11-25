import { FactoryProvider, Injectable } from '@nestjs/common';

/**
 * Status HTTP de cada código de erro de domínio. Cada módulo registra os seus ao subir, com
 * `provideErrorStatuses`, e o `ProblemDetailsFilter` consulta. O domínio não conhece HTTP, e a base
 * não conhece os códigos dos módulos.
 */
@Injectable()
export class ErrorStatusRegistry {
  private readonly statuses = new Map<string, number>();

  register(statuses: Record<string, number>): void {
    for (const [code, status] of Object.entries(statuses)) {
      const current = this.statuses.get(code);
      // o mesmo par de novo é aceito: o helper pode rodar mais de uma vez num teste
      if (current !== undefined && current !== status) {
        throw new Error(
          `Código de erro ${code} registrado com dois status: ${current} e ${status}.`,
        );
      }
      this.statuses.set(code, status);
    }
  }

  statusOf(code: string): number | undefined {
    return this.statuses.get(code);
  }
}

/**
 * Provider que registra os status no `ErrorStatusRegistry` quando o módulo instancia os providers.
 * Vai nos `providers` do Nest module. O token é único por chamada, para dois módulos não se
 * sobrescreverem.
 */
export function provideErrorStatuses(statuses: Record<string, number>): FactoryProvider<void> {
  return {
    provide: Symbol('ErrorStatuses'),
    useFactory: (registry: ErrorStatusRegistry) => registry.register(statuses),
    inject: [ErrorStatusRegistry],
  };
}
