/** Log estruturado: o primeiro argumento são os campos, o segundo a mensagem. */
export abstract class Logger {
  abstract info(fields: Record<string, unknown>, message: string): void;
  abstract warn(fields: Record<string, unknown>, message: string): void;
  abstract error(fields: Record<string, unknown>, message: string): void;
}
