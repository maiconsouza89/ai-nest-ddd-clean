import { Transform } from 'class-transformer';

// Tira os espaços das pontas antes da validação, para que @Length e @MaxLength meçam o valor que
// será salvo. Só age com ValidationPipe({ transform: true }); um valor que não é string passa igual.
export const Trim = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));
