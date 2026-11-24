import { EmailSender } from '../ports/email-sender.js';

export type SendVerificationCodeEmailInput = {
  email: string;
  name: string;
  code: string;
  /** ISO 8601 */
  issuedAt: string;
  /** ISO 8601 */
  expiresAt: string;
};

export class SendVerificationCodeEmailUseCase {
  constructor(private readonly emails: EmailSender) {}

  async execute({ email, name, code, issuedAt, expiresAt }: SendVerificationCodeEmailInput) {
    const minutes = Math.round((Date.parse(expiresAt) - Date.parse(issuedAt)) / 60_000);
    await this.emails.send({
      to: email,
      subject: 'Seu código de verificação',
      body:
        `Olá, ${name}.\n\n` +
        `Seu código de verificação é ${code}. Ele vale por ${minutes} minutos e pode ser usado uma vez.\n\n` +
        'Se você não criou uma conta, ignore este e-mail.',
    });
  }
}
