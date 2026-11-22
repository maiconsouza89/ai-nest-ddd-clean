import { Logger } from '#shared/application/ports/logger';
import { EmailSender } from '../ports/email-sender.js';
import { RecipientDirectory } from '../ports/recipient-directory.js';

export type SendOrderPaidEmailInput = {
  orderId: string;
  customerId: string;
  totalCents: number;
  currency: string;
};

export class SendOrderPaidEmailUseCase {
  constructor(
    private readonly recipients: RecipientDirectory,
    private readonly emails: EmailSender,
    private readonly logger: Logger,
  ) {}

  async execute({ orderId, customerId, totalCents, currency }: SendOrderPaidEmailInput) {
    const to = await this.recipients.emailOf(customerId);
    if (!to) {
      // cliente apagado: repetir não adianta, então registra e segue
      this.logger.warn({ orderId, customerId }, 'order paid email skipped: recipient not found');
      return;
    }
    const total = `${currency} ${(totalCents / 100).toFixed(2)}`;
    await this.emails.send({
      to,
      subject: `Pagamento confirmado: pedido ${orderId}`,
      body: `Recebemos o pagamento de ${total} do seu pedido ${orderId}.`,
    });
  }
}
