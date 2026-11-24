// Evento público do identity (v1). Só primitivos; mudança que quebra vira VerificationCodeIssuedV2.
// Leva o código em texto puro, para o notifications enviá-lo: ele fica na outbox até a limpeza
// (ADR 0009).
export type VerificationCodeIssuedV1 = {
  eventId: string;
  type: 'identity.verification-code-issued';
  version: 1;
  occurredAt: string;
  payload: { userId: string; email: string; name: string; code: string; expiresAt: string };
};
