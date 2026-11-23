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
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  // curto porque não há como revogar um access token antes de ele vencer
  @IsInt()
  @Min(1)
  JWT_ACCESS_TTL_SECONDS: number = 900;

  // validade de cada refresh token; cada renovação emite um novo
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_SECONDS: number = 30 * 24 * 60 * 60;

  // prazo absoluto da sessão, contado do login: depois dele, só com a senha de novo
  @IsInt()
  @Min(1)
  REFRESH_FAMILY_MAX_AGE_SECONDS: number = 90 * 24 * 60 * 60;

  // texto, e não boolean: o `enableImplicitConversion` transformaria 'false' em true
  @IsIn(['true', 'false'])
  OUTBOX_WORKER_ENABLED: string = 'true';

  // liga os workers das filas de eventos (ex.: desligue nas instâncias que só atendem HTTP)
  @IsIn(['true', 'false'])
  QUEUE_WORKERS_ENABLED: string = 'true';

  // origens permitidas no CORS, separadas por vírgula; vazio = CORS desligado
  @IsString()
  CORS_ORIGINS: string = '';

  // quantos proxies confiáveis existem na frente da API (0 = nenhum)
  @IsInt()
  @Min(0)
  TRUST_PROXY: number = 0;

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL: string = 'info';

  // desliga os jobs agendados (ex.: instâncias que só atendem HTTP)
  @IsIn(['true', 'false'])
  JOBS_ENABLED: string = 'true';

  // pedidos em DRAFT/PLACED parados por mais tempo que isso são cancelados
  @IsInt()
  @Min(1)
  ORDER_EXPIRATION_MINUTES: number = 1440;

  @IsIn(['true', 'false'])
  THROTTLE_ENABLED: string = 'true';
}

// Variáveis que mudaram de nome. Sem esta checagem, o valor antigo seria ignorado sem aviso e o
// padrão da nova valeria no lugar dele.
const RENAMED: Record<string, string> = { JWT_EXPIRES_IN_SECONDS: 'JWT_ACCESS_TTL_SECONDS' };

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const renamed = Object.entries(RENAMED)
    .filter(([old]) => old in config)
    .map(([old, current]) => `  - ${old}: renamed to ${current}`);
  const invalid = validateSync(env, { skipMissingProperties: false }).map(
    (e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
  );
  const details = [...renamed, ...invalid];
  if (details.length) {
    throw new Error(`Invalid environment configuration:\n${details.join('\n')}`);
  }
  return env;
}
