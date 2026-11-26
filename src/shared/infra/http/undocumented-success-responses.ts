import type {
  OpenAPIObject,
  OperationObject,
  ReferenceObject,
  ResponseObject,
  SchemaObject,
} from '@nestjs/swagger';

type Schema = SchemaObject | ReferenceObject;

/** Os métodos HTTP de um path item do OpenAPI. */
export const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;
// os status de sucesso com corpo no projeto; o 202 e o 204 respondem sem corpo
const STATUSES_WITH_BODY = ['200', '201'];

/**
 * As operações sem resposta de sucesso documentada, e as respostas 200 e 201 sem schema que descreva
 * o corpo: sem `content`, com `{ "type": "object" }` sem propriedades, ou com `$ref` para um schema
 * assim. Uma por item, no formato `"<MÉTODO> <caminho> <status>"`, com `2xx` na operação sem
 * resposta de sucesso. O `src/openapi.ts` falha se a lista não for vazia.
 */
export function findUndocumentedSuccessResponses(document: OpenAPIObject): string[] {
  const schemas = document.components?.schemas ?? {};

  // Um $ref já visitado conta como documentado: um schema recursivo (`children: Node[]`) não entra em laço.
  const isDocumented = (schema: Schema | undefined, seen = new Set<string>()): boolean => {
    if (!schema) return false;
    if ('$ref' in schema) {
      if (seen.has(schema.$ref)) return true;
      const name = schema.$ref.replace('#/components/schemas/', '');
      return isDocumented(schemas[name], new Set(seen).add(schema.$ref));
    }
    // todo ramo conta: o envelope da paginação não cobre um item sem schema
    if (schema.allOf) return schema.allOf.every((branch) => isDocumented(branch, seen));
    if (schema.type === 'array') return isDocumented(schema.items, seen);
    if (schema.properties) {
      const properties = Object.values(schema.properties);
      return (
        properties.length > 0 &&
        properties.every((p) => !pointsElsewhere(p) || isDocumented(p, seen))
      );
    }
    return schema.type !== undefined && schema.type !== 'object';
  };
  // Uma propriedade só é conferida a fundo quando aponta para outro schema. As outras, como os
  // `example` que o health/ready sobrepõe ao schema do Terminus, valem como estão.
  const pointsElsewhere = (schema: Schema) =>
    '$ref' in schema || !!schema.allOf || schema.type === 'array';

  const hasDocumentedBody = (response: ResponseObject | ReferenceObject | undefined) =>
    !!response &&
    'content' in response &&
    Object.values(response.content ?? {}).some((media) => isDocumented(media.schema));

  return Object.entries(document.paths).flatMap(([path, item]) =>
    HTTP_METHODS.flatMap((method) => {
      const operation: OperationObject | undefined = item[method];
      if (!operation) return [];
      const { responses } = operation;
      // sem 2xx, o plugin não documentou a resposta: um @ApiProblemResponse desliga a inferência
      if (!Object.keys(responses).some((status) => status.startsWith('2'))) {
        return [`${method.toUpperCase()} ${path} 2xx`];
      }
      return STATUSES_WITH_BODY.filter(
        (status) => status in responses && !hasDocumentedBody(responses[status]),
      ).map((status) => `${method.toUpperCase()} ${path} ${status}`);
    }),
  );
}
