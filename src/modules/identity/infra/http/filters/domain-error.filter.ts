import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '#shared/domain/domain-error';

const STATUS: Record<string, number> = {
  EMAIL_ALREADY_IN_USE: 409,
  INVALID_CREDENTIALS: 401,
  EMAIL_NOT_VERIFIED: 403,
  INVALID_VERIFICATION_CODE: 400,
  INVALID_REFRESH_TOKEN: 401,
  INVALID_EMAIL: 422,
  INVALID_NAME: 422,
};

@Catch(DomainError)
export class IdentityDomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(STATUS[error.code] ?? 422).json({ code: error.code, message: error.message });
  }
}
