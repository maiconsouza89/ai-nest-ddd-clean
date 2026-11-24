import { EmailSender } from '../ports/email-sender.js';

export type SendWelcomeEmailInput = { email: string; name: string };

export class SendWelcomeEmailUseCase {
  constructor(private readonly emails: EmailSender) {}

  async execute({ email, name }: SendWelcomeEmailInput) {
    await this.emails.send({
      to: email,
      subject: `Boas-vindas, ${name}`,
      body: `Olá, ${name}.\n\nSeu e-mail foi verificado, e sua conta está pronta para uso.`,
    });
  }
}
