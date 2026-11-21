// PROVISÓRIO: dá um Actor às rotas antes da autenticação real. Sai no passo 19.
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Actor } from '../../application/actor';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const id = req.header('x-user-id');
    if (!id) throw new UnauthorizedException();
    req.user = {
      id,
      roles: (req.header('x-user-roles') ?? '').split(',').filter(Boolean),
    } satisfies Actor;
    return true;
  }
}
