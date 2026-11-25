/** Status HTTP de cada código de erro do identity. O `ProblemDetailsFilter` do shared monta a resposta. */
export const IDENTITY_ERROR_STATUSES = {
  EMAIL_ALREADY_IN_USE: 409,
  INVALID_CREDENTIALS: 401,
  EMAIL_NOT_VERIFIED: 403,
  INVALID_VERIFICATION_CODE: 400,
  INVALID_REFRESH_TOKEN: 401,
  INVALID_EMAIL: 422,
  INVALID_NAME: 422,
} satisfies Record<string, number>;
