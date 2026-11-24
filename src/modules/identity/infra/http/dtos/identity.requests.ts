import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '#shared/infra/http/trim.decorator';

export class RegisterRequest {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class RefreshTokenRequest {
  // 32 bytes em base64url dão 43 caracteres; o limite só barra lixo grande antes do hash
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  refreshToken!: string;
}

export class LoginRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
