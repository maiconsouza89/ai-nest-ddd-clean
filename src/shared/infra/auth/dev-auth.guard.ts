// PROVISÓRIO: dá um Actor às rotas antes da autenticação real. Sai no passo 19.
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Actor } from '../../application/actor';

@Injectable()
export class DevAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
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
