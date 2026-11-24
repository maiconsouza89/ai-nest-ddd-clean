export abstract class VerificationCodeGenerator {
  /** Um código numérico curto, para o usuário digitar. Vai no e-mail e nunca é gravado. */
  abstract generate(): string;
  /** O hash que o banco guarda no lugar do código. Determinístico, para comparar. */
  abstract hash(code: string): string;
}
