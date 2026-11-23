import { Body, Controller, HttpCode, Post, UseFilters } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { seconds, Throttle } from '@nestjs/throttler';
import { Public } from '#shared/infra/auth/public.decorator';
import { LoginUseCase } from '../../../application/use-cases/login.use-case.js';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case.js';
import { RefreshSessionUseCase } from '../../../application/use-cases/refresh-session.use-case.js';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case.js';
import { LoginRequest, RefreshTokenRequest, RegisterRequest } from '../dtos/identity.requests.js';
import { IdentityDomainErrorFilter } from '../filters/domain-error.filter.js';

@ApiTags('auth')
@Public()
@Controller('auth')
@UseFilters(IdentityDomainErrorFilter)
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly login: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logoutSession: LogoutUseCase,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  register(@Body() body: RegisterRequest) {
    return this.registerUser.execute(body);
  }

  /** Devolve o access token, a validade dele em segundos e o refresh token. */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @HttpCode(200)
  signIn(@Body() body: LoginRequest) {
    return this.login.execute(body);
  }

  /**
   * Troca o refresh token por um par novo. Cada refresh token vale uma vez: reusar um já trocado
   * revoga a sessão inteira.
   */
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @HttpCode(200)
  @ApiUnauthorizedResponse({
    description: 'Refresh token desconhecido, vencido, revogado ou reusado.',
  })
  refresh(@Body() body: RefreshTokenRequest) {
    return this.refreshSession.execute(body.refreshToken);
  }

  /** Encerra a sessão do refresh token. Responde 204 mesmo para token desconhecido. */
  @Post('logout')
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Sessão encerrada.' })
  async logout(@Body() body: RefreshTokenRequest) {
    await this.logoutSession.execute(body.refreshToken);
  }
}
