import { Body, Controller, HttpCode, Post, UseFilters } from '@nestjs/common';
import { Public } from '../../../../../shared/infra/auth/public.decorator';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case';
import { LoginRequest, RegisterRequest } from '../dtos/identity.requests';
import { IdentityDomainErrorFilter } from '../filters/domain-error.filter';

@Public()
@Controller('auth')
@UseFilters(IdentityDomainErrorFilter)
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly login: LoginUseCase,
  ) {}

  @Post('register')
  register(@Body() body: RegisterRequest) {
    return this.registerUser.execute(body);
  }

  @Post('login')
  @HttpCode(200)
  signIn(@Body() body: LoginRequest) {
    return this.login.execute(body);
  }
}
