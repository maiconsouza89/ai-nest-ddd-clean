import { Module } from '@nestjs/common';
import { Logger } from '../../../shared/application/ports/logger';
import { UserDirectoryFacade } from '../../identity/contracts/user-directory.facade';
import { EmailSender } from '../application/ports/email-sender';
import { RecipientDirectory } from '../application/ports/recipient-directory';
import { SendOrderPaidEmailUseCase } from '../application/use-cases/send-order-paid-email.use-case';
import { IdentityRecipientDirectory } from './adapters/identity-recipient-directory';
import { LoggingEmailSender } from './adapters/logging-email-sender';
import { OnOrderPaidHandler } from './events/on-order-paid.handler';

@Module({
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
