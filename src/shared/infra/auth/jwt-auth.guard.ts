import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Actor } from '../../application/actor.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

type AuthRequest = { headers: Record<string, string | undefined>; user?: Actor };

// Guard global: toda rota nasce protegida. Valida só a assinatura e as claims do token,
// sem consultar a tabela de usuários (o identity é o único dono desses dados).
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const token = this.extractBearerToken(req);
    if (!token) throw new UnauthorizedException();

    try {
      // algoritmo e segredo vêm da configuração do JwtModule (AuthModule)
      req.user = this.toActor(await this.jwt.verifyAsync(token));
    } catch {
      throw new UnauthorizedException(); // assinatura, expiração e claims inválidas: mesma resposta
    }
    return true;
  }

  private extractBearerToken(req: AuthRequest) {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
  }

  private toActor(claims: Record<string, unknown>): Actor {
    const { sub, roles, tenantId } = claims;
    const validRoles = Array.isArray(roles) && roles.every((r) => typeof r === 'string');
    if (typeof sub !== 'string' || !validRoles) throw new Error('invalid claims');
    return {
      id: sub,
      roles,
      ...(typeof tenantId === 'string' ? { tenantId } : {}),
    };
  }
}
