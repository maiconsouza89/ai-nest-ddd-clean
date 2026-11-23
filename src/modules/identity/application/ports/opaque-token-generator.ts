export abstract class OpaqueTokenGenerator {
  /** Um valor aleatório de alta entropia, entregue ao cliente e nunca guardado. */
  abstract generate(): string;
  /** O hash que o banco guarda no lugar do valor. Determinístico, para buscar por ele. */
  abstract hash(value: string): string;
}
