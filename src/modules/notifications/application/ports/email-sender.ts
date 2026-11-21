export type Email = { to: string; subject: string; body: string };

export abstract class EmailSender {
  /** Lança erro se o envio falhar; quem chama via evento deixa a outbox repetir. */
  abstract send(email: Email): Promise<void>;
}
