import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiProperty, getSchemaPath } from '@nestjs/swagger';

/**
 * Metadados da página de uma listagem: o schema do `Page` de `#shared/application/page`. Os `items`
 * entram pelo `ApiPageResponse`, porque o genérico não tem metadado em tempo de execução.
 */
export class PageResponse {
  /** Total de itens em todas as páginas. */
  @ApiProperty({ type: 'integer' })
  total!: number;

  /** Página devolvida, a partir de 1. */
  @ApiProperty({ type: 'integer' })
  page!: number;

  /** Tamanho máximo da página pedido. */
  @ApiProperty({ type: 'integer' })
  limit!: number;
}

/** Documenta o 200 de uma listagem paginada: o `PageResponse` com os `items` do `model`. */
export function ApiPageResponse(model: Type) {
  return applyDecorators(
    ApiExtraModels(PageResponse, model),
    ApiOkResponse({
      schema: {
        type: 'object',
        allOf: [
          { $ref: getSchemaPath(PageResponse) },
          {
            properties: { items: { type: 'array', items: { $ref: getSchemaPath(model) } } },
            required: ['items'],
          },
        ],
      },
    }),
  );
}
