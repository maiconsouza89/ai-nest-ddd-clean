import { VerificationCodeIssuedV1 } from './verification-code-issued.event.js';

// Exemplo versionado do contrato. Quem publica gera algo compatível com ele e quem consome entende ele.
// Campo novo opcional: mesma versão. Campo removido, renomeado ou com outro tipo: crie a V2.
export const verificationCodeIssuedV1Example: VerificationCodeIssuedV1 = {
  eventId: '0197a1b2-0000-7000-8000-000000000011',
  type: 'identity.verification-code-issued',
  version: 1,
  occurredAt: '2026-01-01T12:00:00.000Z',
  payload: {
    userId: '0197a1b2-0000-7000-8000-0000000000c1',
    email: 'ana@example.com',
    name: 'Ana',
    code: '042137',
    expiresAt: '2026-01-01T12:10:00.000Z',
  },
};
