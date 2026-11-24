import { VerificationCodeGenerator } from '#modules/identity/application/ports/verification-code-generator';

// Códigos previsíveis (`000001`, `000002`...) e um "hash" legível, para os testes conferirem o que foi gravado.
export class FakeVerificationCodeGenerator implements VerificationCodeGenerator {
  private count = 0;

  generate() {
    return String(++this.count).padStart(6, '0');
  }

  hash(code: string) {
    return `hash:${code}`;
  }
}
