import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { seconds, Throttle } from '@nestjs/throttler';
import { Public } from '#shared/infra/auth/public.decorator';
import { ApiProblemResponse } from '#shared/infra/http/problem-details.response';
import { ThrottleByAccount } from '#shared/infra/http/throttle-by-account.decorator';
import { LoginUseCase } from '../../../application/use-cases/login.use-case.js';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case.js';
import { RefreshSessionUseCase } from '../../../application/use-cases/refresh-session.use-case.js';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case.js';
import { ResendVerificationCodeUseCase } from '../../../application/use-cases/resend-verification-code.use-case.js';
import { VerifyEmailUseCase } from '../../../application/use-cases/verify-email.use-case.js';
import { loginAccountTracker } from '../login-account.tracker.js';
import {
  LoginRequest,
  RefreshTokenRequest,
  RegisterRequest,
  ResendVerificationCodeRequest,
  VerifyEmailRequest,
} from '../dtos/identity.requests.js';
import { RegisteredUserResponse, SessionResponse } from '../dtos/identity.responses.js';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly login: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logoutSession: LogoutUseCase,
    private readonly verifyEmailCode: VerifyEmailUseCase,
    private readonly resendCode: ResendVerificationCodeUseCase,
  ) {}

  /** Cria a conta com o e-mail por verificar e envia o código de verificação por e-mail. */
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @ApiCreatedResponse({ type: RegisteredUserResponse, description: 'Conta criada.' })
  register(@Body() body: RegisterRequest): Promise<RegisteredUserResponse> {
    return this.registerUser.execute(body);
  }

  /**
   * Confere o código enviado por e-mail e marca o e-mail como verificado. Não abre sessão: o
   * login vem depois.
   */
  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'E-mail verificado.' })
  @ApiProblemResponse(
    400,
    'Corpo inválido, ou INVALID_VERIFICATION_CODE: código errado, vencido, já usado, esgotado ou e-mail desconhecido.',
  )
  async verifyEmail(@Body() body: VerifyEmailRequest) {
    await this.verifyEmailCode.execute(body);
  }

  /**
   * Envia um código novo, que invalida o anterior. Responde 202 sempre, inclusive para e-mail
   * desconhecido, conta já verificada ou pedido antes de 60 segundos do último código.
   */
  @Post('resend-verification-code')
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @HttpCode(202)
  @ApiAcceptedResponse({ description: 'Pedido aceito. O e-mail sai só se couber.' })
  async resendVerificationCode(@Body() body: ResendVerificationCodeRequest) {
    await this.resendCode.execute(body);
  }

  /** Devolve o access token, a validade dele em segundos e o refresh token. */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @ThrottleByAccount(loginAccountTracker)
  @HttpCode(200)
  @ApiOkResponse({ type: SessionResponse, description: 'Sessão aberta.' })
  @ApiProblemResponse(401, 'INVALID_CREDENTIALS: e-mail ou senha errados.')
  @ApiProblemResponse(403, 'EMAIL_NOT_VERIFIED: senha certa, e-mail por verificar.')
  signIn(@Body() body: LoginRequest): Promise<SessionResponse> {
    return this.login.execute(body);
  }

  /**
   * Troca o refresh token por um par novo. Cada refresh token vale uma vez: reusar um já trocado
   * revoga a sessão inteira.
   */
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @HttpCode(200)
  @ApiOkResponse({ type: SessionResponse, description: 'Par de tokens novo.' })
  @ApiProblemResponse(401, 'Refresh token desconhecido, vencido, revogado ou reusado.')
  refresh(@Body() body: RefreshTokenRequest): Promise<SessionResponse> {
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
