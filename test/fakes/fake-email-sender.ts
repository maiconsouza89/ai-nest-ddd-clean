import { Email, EmailSender } from '#modules/notifications/application/ports/email-sender';

// Guarda as mensagens em vez de enviar, para os testes conferirem destinatário, assunto e corpo.
export class FakeEmailSender implements EmailSender {
  readonly sent: Email[] = [];

  async send(email: Email) {
    this.sent.push(email);
  }
}
