import { EmailVerifiedV1 } from './email-verified.event.js';

// Exemplo versionado do contrato (regras de versão em verification-code-issued.v1.example.ts).
export const emailVerifiedV1Example: EmailVerifiedV1 = {
  eventId: '0197a1b2-0000-7000-8000-000000000012',
  type: 'identity.email-verified',
  version: 1,
  occurredAt: '2026-01-01T12:05:00.000Z',
  payload: {
    userId: '0197a1b2-0000-7000-8000-0000000000c1',
    email: 'ana@example.com',
    name: 'Ana',
  },
};
