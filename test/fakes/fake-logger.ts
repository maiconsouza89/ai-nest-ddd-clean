import { Logger } from '../../src/shared/application/ports/logger';

export class FakeLogger implements Logger {
  readonly entries: { level: string; fields: Record<string, unknown>; message: string }[] = [];
  info(fields: Record<string, unknown>, message: string) {
    this.entries.push({ level: 'info', fields, message });
  }
  warn(fields: Record<string, unknown>, message: string) {
    this.entries.push({ level: 'warn', fields, message });
  }
  error(fields: Record<string, unknown>, message: string) {
    this.entries.push({ level: 'error', fields, message });
  }
}
