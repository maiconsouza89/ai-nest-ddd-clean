export type RegisterUserInput = { name: string; email: string; password: string };
export type LoginInput = { email: string; password: string };
export type VerifyEmailInput = { email: string; code: string };
export type ResendVerificationCodeInput = { email: string };
