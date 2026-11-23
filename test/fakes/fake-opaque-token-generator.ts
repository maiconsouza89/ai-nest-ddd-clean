import { OpaqueTokenGenerator } from '#modules/identity/application/ports/opaque-token-generator';

// Valores previsíveis (`rt-1`, `rt-2`...) e um "hash" legível, para os testes conferirem o que foi gravado.
export class FakeOpaqueTokenGenerator implements OpaqueTokenGenerator {
  private count = 0;

  generate() {
    return `rt-${++this.count}`;
  }

  hash(value: string) {
    return `hash:${value}`;
  }
}
