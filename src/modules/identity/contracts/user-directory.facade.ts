// API pública do identity: só tipos primitivos.
export abstract class UserDirectoryFacade {
  /** O e-mail do usuário, ou null se o id não existir. */
  abstract emailOf(userId: string): Promise<string | null>;
}
