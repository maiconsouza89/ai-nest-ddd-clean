import { Logger } from '../../../../shared/application/ports/logger';
import { Email, EmailSender } from '../../application/ports/email-sender';

/**
 * Remetente simulado, para desenvolvimento: só registra no log, sem o endereço do destinatário.
 * Ao integrar um provedor de e-mail, troque só este adapter e aplique timeout na chamada.
 * Não precisa de retry próprio: se falhar, a outbox reentrega o evento.
 */
export class LoggingEmailSender implements EmailSender {
  constructor(private readonly logger: Logger) {}

  async send({ subject }: Email) {
    this.logger.info({ subject }, 'email sent (simulated)');
  }
}
