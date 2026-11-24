import { createHash, randomInt } from 'node:crypto';
import { VerificationCodeGenerator } from '../../application/ports/verification-code-generator.js';

// Seis dígitos têm só 1 milhão de valores: o hash não protege contra força bruta, quem protege é o
// limite de tentativas e o prazo curto. O hash só evita que o código fique legível na tabela.
export class CryptoVerificationCodeGenerator implements VerificationCodeGenerator {
  generate() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  hash(code: string) {
    return createHash('sha256').update(code).digest('hex');
  }
}
