import { Email } from '../../domain/value-objects/email.vo.js';

/**
 * A chave do limite por conta do login: o e-mail normalizado, pela mesma regra do `LoginUseCase`.
 * O guard roda antes do `ValidationPipe`, então o corpo chega cru. Sem um e-mail válido, devolve
 * `undefined`, o limite por conta não conta, e o `ValidationPipe` responde 400.
 */
export function loginAccountTracker(req: Record<string, unknown>) {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? Email.tryCreate(email)?.value : undefined;
}
