import { ServiceUnavailableException } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { Logger } from '../../application/ports/logger.js';

type ThrottleHit = [totalHits: number, ttlMs: number, blocked: number, blockTtlMs: number];
type ThrottleRedis = Redis & {
  throttleHit(
    hitsKey: string,
    blockKey: string,
    ttlMs: number,
    limit: number,
    blockMs: number,
  ): Promise<ThrottleHit>;
};

// Janela fixa a partir do primeiro acesso. Contar, expirar e bloquear num script só mantém tudo
// atômico entre instâncias. Durante o bloqueio, os acessos não são contados.
const SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  return { tonumber(redis.call('GET', KEYS[1]) or '0'), redis.call('PTTL', KEYS[1]), 1, blockTtl }
end
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if hits == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
if hits > tonumber(ARGV[2]) then
  local blockMs = tonumber(ARGV[3])
  if blockMs > 0 then
    redis.call('SET', KEYS[2], 1, 'PX', blockMs)
  end
  return { hits, ttl, 1, blockMs }
end
return { hits, ttl, 0, 0 }
`;

/**
 * Armazena os contadores do `@nestjs/throttler` no Redis, para o limite valer para a soma das instâncias.
 *
 * Redis fora do ar: falha fechada (503). Deixar passar abriria o limite de login justamente quando
 * não dá para contar tentativas, e o Redis fora do ar já degrada o resto da API (fila de eventos, cache).
 * Use uma conexão sem fila offline, para a falha ser imediata em vez de a requisição ficar pendurada.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly redis: ThrottleRedis;

  constructor(
    redis: Redis,
    private readonly logger: Logger,
  ) {
    // defineCommand usa EVALSHA e recarrega o script sozinho se o Redis o perder
    redis.defineCommand('throttleHit', { numberOfKeys: 2, lua: SCRIPT });
    this.redis = redis as ThrottleRedis;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    // hash tag: as duas chaves caem no mesmo slot, exigência do script no Redis Cluster
    const base = `throttle:{${throttlerName}:${key}}`;
    try {
      const [totalHits, ttlMs, blocked, blockTtlMs] = await this.redis.throttleHit(
        base,
        `${base}:block`,
        ttl,
        limit,
        blockDuration,
      );
      return {
        totalHits,
        // a chave de bloqueio pode viver mais que a da contagem, e o PTTL dela volta negativo
        timeToExpire: Math.max(0, Math.ceil(ttlMs / 1000)),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(blockTtlMs / 1000),
      };
    } catch (err) {
      this.logger.error({ err }, 'rate limit storage unavailable');
      throw new ServiceUnavailableException('Rate limiting unavailable');
    }
  }
}
