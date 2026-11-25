import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { EnvironmentVariables } from '../config/env.validation.js';
import { HealthController } from './health.controller.js';
import { RedisHealthIndicator } from './redis-health.indicator.js';

@Module({
  imports: [
    // no SIGTERM, o /health/ready responde 503 durante o atraso, antes de o servidor HTTP fechar
    TerminusModule.forRootAsync({
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        gracefulShutdownTimeoutMs: config.getOrThrow('SHUTDOWN_GRACE_MS', { infer: true }),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
