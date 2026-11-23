import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { FakeActorResolver } from '#test/fakes/fake-actor-resolver';
import { httpContext } from '#test/helpers/http-context';
import { Actor } from '../../application/actor.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { jwtModuleOptions } from './jwt-config.module.js';

const jwt = new JwtService(jwtModuleOptions('s'.repeat(32)));

function setup({ isPublic = false } = {}) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
  const actors = new FakeActorResolver();
  const guard = new JwtAuthGuard(jwt, reflector, actors);
  const run = (authorization?: string) => {
    const req: { headers: Record<string, string | undefined>; user?: Actor } = {
      headers: { authorization },
    };
    return { req, result: guard.canActivate(httpContext(req)) };
  };
  return { actors, run };
}

const bearer = async (payload: object) =>
  `Bearer ${await jwt.signAsync(payload, { expiresIn: 60 })}`;

describe('JwtAuthGuard', () => {
  it('põe no request o ator atual do resolver, e não as roles do token', async () => {
    const { actors, run } = setup();
    actors.actors.set('u1', { id: 'u1', roles: ['admin'] });

    const { req, result } = run(await bearer({ sub: 'u1', roles: ['user'] }));

    await expect(result).resolves.toBe(true);
    expect(req.user).toEqual({ id: 'u1', roles: ['admin'] });
  });

  it('responde 401 quando o usuário não existe mais', async () => {
    const { run } = setup();
    await expect(run(await bearer({ sub: 'gone' })).result).rejects.toThrow(UnauthorizedException);
  });

  it('responde 401 com token adulterado', async () => {
    const { actors, run } = setup();
    actors.actors.set('admin', { id: 'admin', roles: ['admin'] });
    // payload trocado para o de outro usuário, mantendo a assinatura original
    const [header, , signature] = (await jwt.signAsync({ sub: 'u1' })).split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'admin' })).toString('base64url');

    await expect(run(`Bearer ${header}.${forgedPayload}.${signature}`).result).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('responde 401 sem token e com token sem sub', async () => {
    const { run } = setup();
    await expect(run().result).rejects.toThrow(UnauthorizedException);
    await expect(run(await bearer({ foo: 'bar' })).result).rejects.toThrow(UnauthorizedException);
  });

  it('responde 401 com token sem exp, que nunca venceria', async () => {
    const { actors, run } = setup();
    actors.actors.set('u1', { id: 'u1', roles: [] });
    const forever = await jwt.signAsync({ sub: 'u1' }); // o JwtConfigModule não põe exp padrão
    await expect(run(`Bearer ${forever}`).result).rejects.toThrow(UnauthorizedException);
  });

  it('não converte em 401 uma falha do resolver', async () => {
    const { actors, run } = setup();
    vi.spyOn(actors, 'resolve').mockRejectedValue(new Error('db down'));
    await expect(run(await bearer({ sub: 'u1' })).result).rejects.toThrow('db down');
  });

  it('libera rota pública sem consultar o resolver', async () => {
    const { actors, run } = setup({ isPublic: true });
    const resolve = vi.spyOn(actors, 'resolve');
    await expect(run().result).resolves.toBe(true);
    expect(resolve).not.toHaveBeenCalled();
  });
});
