export class RegisteredUserResponse {
  /** Id da conta criada. */
  id!: string;
}

export class SessionResponse {
  /** JWT do header `Authorization: Bearer`. */
  accessToken!: string;

  /** Validade do access token, em segundos. */
  expiresIn!: number;

  /** Token opaco para o `POST /v1/auth/refresh` e o `POST /v1/auth/logout`. Vale uma vez. */
  refreshToken!: string;
}
