import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { Actor } from '#shared/application/actor';
import { CurrentUser } from '#shared/infra/auth/current-user.decorator';
import { Roles } from '#shared/infra/auth/roles.decorator';

/**
 * Rotas protegidas só para os testes do guard global e das roles. A base não tem rota protegida
 * própria, e os testes não podem depender dos módulos de exemplo. Registre no `TestingModule`:
 * `controllers: [GuardProbeController]`.
 */
@Controller('guard-probe')
export class GuardProbeController {
  /** Qualquer usuário autenticado; devolve o ator que o guard carregou. */
  @Get()
  whoAmI(@CurrentUser() actor: Actor) {
    return { id: actor.id, roles: actor.roles };
  }

  /** Só admin. */
  @Post('admin')
  @HttpCode(204)
  @Roles('admin')
  adminOnly() {}
}
