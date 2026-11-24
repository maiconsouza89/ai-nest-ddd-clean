import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '#shared/application/ports/logger';
import { EnvironmentVariables } from '#shared/infra/config/env.validation';
import { UserDirectoryFacade } from '#modules/identity/contracts/user-directory.facade';
import { IdentityModule } from '#modules/identity/infra/identity.module';
import { EmailSender } from '../application/ports/email-sender.js';
import { RecipientDirectory } from '../application/ports/recipient-directory.js';
import { SendOrderPaidEmailUseCase } from '../application/use-cases/send-order-paid-email.use-case.js';
import { SendVerificationCodeEmailUseCase } from '../application/use-cases/send-verification-code-email.use-case.js';
import { SendWelcomeEmailUseCase } from '../application/use-cases/send-welcome-email.use-case.js';
import { IdentityRecipientDirectory } from './adapters/identity-recipient-directory.js';
import { SmtpEmailSender } from './adapters/smtp-email-sender.js';
import { OnEmailVerifiedHandler } from './events/on-email-verified.handler.js';
import { OnOrderPaidHandler } from './events/on-order-paid.handler.js';
import { OnVerificationCodeIssuedHandler } from './events/on-verification-code-issued.handler.js';

@Module({
  imports: [IdentityModule],
  providers: [
    {
      provide: EmailSender,
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        new SmtpEmailSender({
          url: config.getOrThrow('SMTP_URL', { infer: true }),
          from: config.getOrThrow('EMAIL_FROM', { infer: true }),
        }),
      inject: [ConfigService],
    },
    {
      provide: SendVerificationCodeEmailUseCase,
      useFactory: (emails: EmailSender) => new SendVerificationCodeEmailUseCase(emails),
      inject: [EmailSender],
    },
    {
      provide: SendWelcomeEmailUseCase,
      useFactory: (emails: EmailSender) => new SendWelcomeEmailUseCase(emails),
      inject: [EmailSender],
    },
    OnVerificationCodeIssuedHandler,
    OnEmailVerifiedHandler,
    // exemplo removível: o aviso de pedido pago e o RecipientDirectory, que só ele usa
    {
      provide: RecipientDirectory,
      useFactory: (users: UserDirectoryFacade) => new IdentityRecipientDirectory(users),
      inject: [UserDirectoryFacade],
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
