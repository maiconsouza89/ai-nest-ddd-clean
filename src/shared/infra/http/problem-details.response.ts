import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
export const PROBLEM_JSON = 'application/problem+json';

/** Um erro de validação: onde no corpo (JSON Pointer) e o que houve. */
export class ValidationProblemResponse {
  @ApiPropertyOptional({
    description:
      'JSON Pointer do campo no objeto validado: o corpo, ou a query num DTO de `@Query()`. Ausente no item que avisa que as mensagens passaram do limite.',
    example: '#/items/0/qty',
  })
  pointer?: string;

  @ApiProperty({ example: 'quantity must not be less than 1' })
  detail!: string;
}

/**
 * Corpo de toda resposta de erro da API: Problem Details (RFC 9457), com as extensões do projeto.
 * Tipo do `ProblemDetailsFilter` e schema do Swagger.
 */
export class ProblemDetailsResponse {
  @ApiProperty({ enum: ['about:blank'], example: 'about:blank' })
  type!: 'about:blank';

  @ApiProperty({ description: 'Frase do status HTTP.', example: 'Unauthorized' })
  title!: string;

  @ApiProperty({ example: 401 })
  status!: number;

  @ApiProperty({
    description: 'Explicação para leitura. O cliente decide pelo `code`, não por este texto.',
    example: 'Invalid email or password',
  })
  detail!: string;

  @ApiProperty({
    description: 'Caminho da requisição, sem a query string.',
    example: '/v1/auth/login',
  })
  instance!: string;

  @ApiProperty({
    description:
      'Código de erro: o do erro de domínio, `VALIDATION_FAILED`, `INTERNAL_ERROR` ou o nome do status (`NOT_FOUND`, `TOO_MANY_REQUESTS`).',
    example: 'INVALID_CREDENTIALS',
  })
  code!: string;

  @ApiPropertyOptional({
    description: 'Id do trace da requisição. Ausente com o tracing desligado.',
    example: '4bf92f3577b34da6a3ce929d0e0e4736',
  })
  traceId?: string;

  @ApiPropertyOptional({
    description: 'Só em `VALIDATION_FAILED`: um item por mensagem.',
    type: [ValidationProblemResponse],
  })
  errors?: ValidationProblemResponse[];
}

/** Conteúdo `application/problem+json` com o schema `ProblemDetailsResponse`. */
export const problemContent = {
  [PROBLEM_JSON]: { schema: { $ref: getSchemaPath(ProblemDetailsResponse) } },
};

/** Documenta uma resposta de erro da operação em Problem Details. */
export function ApiProblemResponse(status: number, description: string) {
  return applyDecorators(
    ApiExtraModels(ProblemDetailsResponse),
    ApiResponse({ status, description, content: problemContent }),
  );
}
