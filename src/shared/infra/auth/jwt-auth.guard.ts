import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Actor } from '../../application/actor.js';
import { ActorResolver } from '../../application/ports/actor-resolver.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

type AuthRequest = { headers: Record<string, string | undefined>; user?: Actor };

// Guard global: toda rota nasce protegida. O token só identifica o usuário (`sub`); o ator, com
// as roles atuais, vem do ActorResolver a cada requisição. Role removida ou conta apagada valem
// na requisição seguinte, e não quando o token expirar (ADR 0002).
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly actors: ActorResolver,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    // fora do try do token: uma falha do resolver (banco fora do ar) é erro do servidor, e não 401
    const actor = await this.actors.resolve(await this.verifiedUserId(req));
    if (!actor) throw new UnauthorizedException(); // o usuário deixou de existir depois do login
    req.user = actor;
    return true;
  }

  // Sem token, assinatura ou expiração inválidas, sem `exp` e sem `sub`: mesma resposta.
  private async verifiedUserId(req: AuthRequest) {
    const token = this.extractBearerToken(req);
    try {
      // algoritmo e segredo vêm da configuração do JwtModule (JwtConfigModule)
      const { sub, exp } = token
        ? await this.jwt.verifyAsync<{ sub?: unknown; exp?: unknown }>(token)
        : {};
      // o jsonwebtoken só confere o `exp` se ele existir; o JwtConfigModule não define validade
      // padrão, então um token assinado sem `expiresIn` valeria para sempre
      if (typeof sub === 'string' && typeof exp === 'number') return sub;
    } catch {
      // cai no 401 abaixo
    }
    throw new UnauthorizedException();
  }

  private extractBearerToken(req: AuthRequest) {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
  }
}
