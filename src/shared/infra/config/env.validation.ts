import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MinLength,
  Min,
  validateSync,
} from 'class-validator';

// O `enableImplicitConversion` transforma '' em 0. Num timeout em que 0 desliga o limite, uma variável
// definida vazia (ex.: `X=${X}` no compose, com X ausente) o desligaria sem aviso; assim ela é recusada.
const RejectBlank = () =>
  Transform(
    ({ obj, key, value }: { obj: Record<string, unknown>; key: string; value: unknown }) => {
      const raw = obj[key];
      return typeof raw === 'string' && raw.trim() === '' ? undefined : value;
    },
  );

// o maior prazo que o setTimeout do Node e os parâmetros de timeout do Postgres aceitam, em ms
const MAX_TIMEOUT_MS = 2_147_483_647;

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

  // conexões no pool de cada processo; instâncias × este valor tem que caber no max_connections
  @IsInt()
  @Min(1)
  DATABASE_POOL_MAX: number = 10;

  // espera por uma conexão (abrir uma nova ou aguardar na fila do pool cheio), em ms
  @IsInt()
  @Min(1)
  @Max(MAX_TIMEOUT_MS)
  DATABASE_CONNECT_TIMEOUT_MS: number = 5000;

  // o servidor cancela a query que passar disso, em ms; 0 = vale o do servidor ou do role
  @RejectBlank()
  @IsInt()
  @Min(0)
  @Max(MAX_TIMEOUT_MS)
  DATABASE_STATEMENT_TIMEOUT_MS: number = 30_000;

  // o servidor encerra a sessão com transação aberta e ociosa por mais que isso, em ms; 0 = vale o do servidor
  @RejectBlank()
  @IsInt()
  @Min(0)
  @Max(MAX_TIMEOUT_MS)
  DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS: number = 60_000;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  // servidor SMTP dos e-mails do notifications, com usuário e senha na URL se houver
  @Matches(/^smtps?:\/\/\S+$/, { message: 'SMTP_URL must be an smtp:// or smtps:// URL' })
  SMTP_URL!: string;

  // remetente dos e-mails, como `no-reply@example.com` ou `App <no-reply@example.com>`
  @IsString()
  @IsNotEmpty()
  EMAIL_FROM!: string;

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

  // validade do código de verificação do e-mail, contada da emissão; o e-mail a mostra em minutos
  @IsInt()
  @Min(60)
  EMAIL_VERIFICATION_CODE_TTL_SECONDS: number = 600;

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

  // atraso do desligamento no SIGTERM, em ms: o /health/ready responde 503 e a app segue atendendo
  @IsInt()
  @Min(0)
  @Max(600_000)
  SHUTDOWN_GRACE_MS: number = 0;

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
