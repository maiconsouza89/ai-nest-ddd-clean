import { createHash, randomBytes } from 'node:crypto';
import { OpaqueTokenGenerator } from '../../application/ports/opaque-token-generator.js';

// 256 bits aleatórios: com essa entropia, um hash rápido basta (não há o que adivinhar por força
// bruta, ao contrário de uma senha), e a busca por hash continua sendo uma leitura por índice.
export class CryptoOpaqueTokenGenerator implements OpaqueTokenGenerator {
  generate() {
    return randomBytes(32).toString('base64url');
  }

  hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
