import { Actor } from '#shared/application/actor';
import { ActorResolver } from '#shared/application/ports/actor-resolver';

export class FakeActorResolver implements ActorResolver {
  readonly actors = new Map<string, Actor>();

  async resolve(userId: string) {
    return this.actors.get(userId) ?? null;
  }
}
