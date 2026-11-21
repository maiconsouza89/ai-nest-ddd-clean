export abstract class RecipientDirectory {
  /** O e-mail do cliente, ou null se ele não existir mais. */
  abstract emailOf(customerId: string): Promise<string | null>;
}
