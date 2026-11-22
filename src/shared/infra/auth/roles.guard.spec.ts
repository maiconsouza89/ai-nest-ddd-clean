import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Actor } from '../../application/actor.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(user: Actor | undefined, roles: string[] | undefined) {
  const handler = () => undefined;
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  return {
    guard: new RolesGuard(reflector),
    ctx: {
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as never,
  };
}

describe('RolesGuard', () => {
  it('libera rotas sem @Roles', () => {
    const { guard, ctx } = contextFor({ id: 'u', roles: [] }, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('libera quem tem um dos papéis exigidos', () => {
    const { guard, ctx } = contextFor({ id: 'u', roles: ['admin'] }, ['admin', 'staff']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('bloqueia quem não tem o papel', () => {
    const { guard, ctx } = contextFor({ id: 'u', roles: ['user'] }, ['admin']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('bloqueia quando não há ator', () => {
    const { guard, ctx } = contextFor(undefined, ['admin']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
