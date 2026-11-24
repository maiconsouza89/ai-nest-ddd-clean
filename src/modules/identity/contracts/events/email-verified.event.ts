// Evento público do identity (v1). Só primitivos; mudança que quebra vira EmailVerifiedV2.
export type EmailVerifiedV1 = {
  eventId: string;
  type: 'identity.email-verified';
  version: 1;
  occurredAt: string;
  payload: { userId: string; email: string; name: string };
};
