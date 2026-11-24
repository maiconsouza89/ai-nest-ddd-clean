import { createTransport } from 'nodemailer';
import { withTimeout } from '#shared/infra/resilience/with-timeout';
import { Email, EmailSender } from '../../application/ports/email-sender.js';

export type SmtpConfig = { url: string; from: string };

// Os prazos do Nodemailer valem por fase (conexão, saudação, inatividade do socket); o padrão dele
// chega a 10 minutos. O withTimeout limita o envio inteiro. Sem retry aqui: se falhar, a fila do
// consumidor entrega o evento de novo (docs/explanation/servicos-externos.md).
const CONNECTION_TIMEOUT_MS = 5_000;
const SOCKET_TIMEOUT_MS = 10_000;
const SEND_TIMEOUT_MS = 15_000;

/** Envia por SMTP. Em desenvolvimento e nos testes, o servidor é o Mailpit do docker-compose. */
export class SmtpEmailSender implements EmailSender {
  private readonly transport;

  constructor(private readonly config: SmtpConfig) {
    this.transport = createTransport({
      url: config.url,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: CONNECTION_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
    });
  }

  async send({ to, subject, body }: Email) {
    await withTimeout(
      () => this.transport.sendMail({ from: this.config.from, to, subject, text: body }),
      SEND_TIMEOUT_MS,
    );
  }
}
