import { Actor } from '../actor.js';

// Implementado pelo módulo dono dos usuários (identity) e ligado no IdentityAuthModule; o AppModule
// só repassa esse módulo para o AuthModule.forRoot (ADR 0002).
export abstract class ActorResolver {
  /** O ator atual do usuário, ou null se ele não existir mais (o guard responde 401). */
  abstract resolve(userId: string): Promise<Actor | null>;
}
