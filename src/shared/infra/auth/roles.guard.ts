import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Actor } from '../../application/actor.js';
import { ROLES_KEY } from './roles.decorator.js';

// Roda depois do JwtAuthGuard, que já colocou o Actor em req.user.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const actor = ctx.switchToHttp().getRequest<{ user?: Actor }>().user;
    if (!actor?.roles.some((r) => required.includes(r))) throw new ForbiddenException();
    return true;
  }
}
