import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Logger } from '../../application/ports/logger';

@Injectable()
export class PinoAppLogger implements Logger {
  constructor(private readonly pino: PinoLogger) {}

  info(fields: Record<string, unknown>, message: string) {
    this.pino.info(fields, message);
  }
  warn(fields: Record<string, unknown>, message: string) {
    this.pino.warn(fields, message);
  }
  error(fields: Record<string, unknown>, message: string) {
    this.pino.error(fields, message);
  }
}
