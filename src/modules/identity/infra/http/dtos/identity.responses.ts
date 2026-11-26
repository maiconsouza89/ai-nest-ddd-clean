import { ApiProperty } from '@nestjs/swagger';

export class RegisteredUserResponse {
  /** Id da conta criada. */
  id!: string;
}

export class SessionResponse {
  /** JWT do header `Authorization: Bearer`. */
  accessToken!: string;

  /** Validade do access token, em segundos. */
  @ApiProperty({ type: 'integer' })
  expiresIn!: number;
}
