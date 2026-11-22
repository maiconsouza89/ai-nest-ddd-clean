import { Module } from '@nestjs/common';
import { Logger } from '#shared/application/ports/logger';
import { UserDirectoryFacade } from '#modules/identity/contracts/user-directory.facade';
import { IdentityModule } from '#modules/identity/infra/identity.module';
import { EmailSender } from '../application/ports/email-sender.js';
import { RecipientDirectory } from '../application/ports/recipient-directory.js';
import { SendOrderPaidEmailUseCase } from '../application/use-cases/send-order-paid-email.use-case.js';
import { IdentityRecipientDirectory } from './adapters/identity-recipient-directory.js';
import { LoggingEmailSender } from './adapters/logging-email-sender.js';
import { OnOrderPaidHandler } from './events/on-order-paid.handler.js';

@Module({
  imports: [IdentityModule],
  providers: [
    {
      provide: RecipientDirectory,
      useFactory: (users: UserDirectoryFacade) => new IdentityRecipientDirectory(users),
      inject: [UserDirectoryFacade],
    },
    {
      provide: EmailSender,
      useFactory: (logger: Logger) => new LoggingEmailSender(logger),
      inject: [Logger],
    },
    {
      provide: SendOrderPaidEmailUseCase,
      useFactory: (recipients: RecipientDirectory, emails: EmailSender, logger: Logger) =>
        new SendOrderPaidEmailUseCase(recipients, emails, logger),
      inject: [RecipientDirectory, EmailSender, Logger],
    },
    OnOrderPaidHandler,
  ],
})
export class NotificationsModule {}
