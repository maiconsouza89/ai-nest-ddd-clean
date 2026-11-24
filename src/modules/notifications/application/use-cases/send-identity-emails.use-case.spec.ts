import { describe, it, expect } from 'vitest';
import { FakeEmailSender } from '#test/fakes/fake-email-sender';
import { SendVerificationCodeEmailUseCase } from './send-verification-code-email.use-case.js';
import { SendWelcomeEmailUseCase } from './send-welcome-email.use-case.js';

describe('SendVerificationCodeEmailUseCase', () => {
  it('envia o código e a validade ao e-mail da conta', async () => {
    const emails = new FakeEmailSender();

    await new SendVerificationCodeEmailUseCase(emails).execute({
      email: 'ana@example.com',
      name: 'Ana',
      code: '042137',
      issuedAt: '2026-01-01T12:00:00.000Z',
      expiresAt: '2026-01-01T12:10:00.000Z',
    });

    expect(emails.sent).toHaveLength(1);
    const [sent] = emails.sent;
    expect(sent.to).toBe('ana@example.com');
    expect(sent.subject).toBe('Seu código de verificação');
    expect(sent.body).toContain('Olá, Ana.');
    expect(sent.body).toContain('042137');
    expect(sent.body).toContain('10 minutos');
  });
});

describe('SendWelcomeEmailUseCase', () => {
  it('envia as boas-vindas com o nome no assunto', async () => {
    const emails = new FakeEmailSender();

    await new SendWelcomeEmailUseCase(emails).execute({ email: 'ana@example.com', name: 'Ana' });

    expect(emails.sent).toEqual([
      {
        to: 'ana@example.com',
        subject: 'Boas-vindas, Ana',
        body: expect.stringContaining('Seu e-mail foi verificado'),
      },
    ]);
  });
});
