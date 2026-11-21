import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MinLength,
  Min,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsEnum(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsInt()
  @Min(1)
  JWT_EXPIRES_IN_SECONDS: number = 3600;

  // texto, e não boolean: o `enableImplicitConversion` transformaria 'false' em true
  @IsIn(['true', 'false'])
  OUTBOX_WORKER_ENABLED: string = 'true';

  // origens permitidas no CORS, separadas por vírgula; vazio = CORS desligado
  @IsString()
  CORS_ORIGINS: string = '';

  // quantos proxies confiáveis existem na frente da API (0 = nenhum)
  @IsInt()
  @Min(0)
  TRUST_PROXY: number = 0;

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL: string = 'info';

  @IsIn(['true', 'false'])
  THROTTLE_ENABLED: string = 'true';
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return env;
}
