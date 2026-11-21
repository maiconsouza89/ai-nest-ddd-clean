import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../../../../shared/domain/domain-error';

const STATUS: Record<string, number> = {
  ORDER_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  NOT_ORDER_OWNER: 403,
  ORDER_ALREADY_PAID: 409,
  ORDER_NOT_EDITABLE: 409,
  ORDER_NOT_PAYABLE: 409,
  ORDER_NOT_CANCELLABLE: 409,
  INSUFFICIENT_STOCK: 409,
  EMPTY_ORDER: 422,
  CONCURRENCY_CONFLICT: 409,
};

@Catch(DomainError)
export class OrdersDomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(STATUS[error.code] ?? 422).json({ code: error.code, message: error.message });
  }
}
