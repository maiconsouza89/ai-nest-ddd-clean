import { Body, Controller, HttpCode, Post, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { seconds, Throttle } from '@nestjs/throttler';
import { Public } from '../../../../../shared/infra/auth/public.decorator';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case';
import { LoginRequest, RegisterRequest } from '../dtos/identity.requests';
import { IdentityDomainErrorFilter } from '../filters/domain-error.filter';

@ApiTags('auth')
@Public()
@Controller('auth')
@UseFilters(IdentityDomainErrorFilter)
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly login: LoginUseCase,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  register(@Body() body: RegisterRequest) {
    return this.registerUser.execute(body);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @HttpCode(200)
  signIn(@Body() body: LoginRequest) {
    return this.login.execute(body);
  }
}
