import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Actor } from '../../application/actor.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor =>
    ctx.switchToHttp().getRequest<{ user: Actor }>().user,
);
