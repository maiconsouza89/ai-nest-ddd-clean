import { Body, Controller, Get, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { DomainError } from '#shared/domain/domain-error';
import { Public } from '#shared/infra/auth/public.decorator';

/** Código que só o teste registra, com `provideErrorStatuses(ERROR_PROBE_STATUSES)` no `TestingModule`. */
export const ERROR_PROBE_STATUSES = { PROBE_TEAPOT: 418 };

class ProbeTeapotError extends DomainError {
  readonly code = 'PROBE_TEAPOT';
}

class ProbeUnmappedError extends DomainError {
  readonly code = 'PROBE_UNMAPPED';
}

class ProbeItem {
  @IsString() name!: string;
  @IsInt() @Min(1) quantity!: number;
}

class ProbeRequest {
  @ValidateNested({ each: true })
  @Type(() => ProbeItem)
  items!: ProbeItem[];
}

/**
 * Rotas que lançam cada tipo de erro, para os testes das respostas em Problem Details. A base não
 * tem rota que lance um erro inesperado, e os testes não podem depender dos módulos de exemplo.
 * Registre no `TestingModule`: `controllers: [ErrorProbeController]`.
 */
@Public()
@Controller('error-probe')
export class ErrorProbeController {
  /** Erro inesperado, com uma mensagem interna que não pode sair na resposta. */
  @Get('unexpected')
  unexpected() {
    throw new Error('connection refused at 10.0.0.5:5432');
  }

  /** Erro de domínio com o código registrado pelo teste. */
  @Get('domain')
  domain() {
    throw new ProbeTeapotError('The probe is a teapot');
  }

  /** Erro de domínio com um código que ninguém registrou. */
  @Get('unmapped')
  unmapped() {
    throw new ProbeUnmappedError('Nobody mapped this code');
  }

  /** Corpo validado, com um campo aninhado. Devolve o corpo quando é válido. */
  @Post('validate')
  validate(@Body() body: ProbeRequest) {
    return body;
  }
}
