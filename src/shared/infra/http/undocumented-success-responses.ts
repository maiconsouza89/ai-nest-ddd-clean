import type {
  OpenAPIObject,
  OperationObject,
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger';

type Schema = SchemaObject | ReferenceObject;

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
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

  const isDocumented = (schema: Schema | undefined): boolean => {
    if (!schema) return false;
    if ('$ref' in schema) {
      return isDocumented(schemas[schema.$ref.replace('#/components/schemas/', '')]);
    }
    const composed = [...(schema.allOf ?? []), ...(schema.oneOf ?? []), ...(schema.anyOf ?? [])];
    if (composed.length > 0) return composed.some(isDocumented);
    if (schema.type === 'array') return isDocumented(schema.items);
    if (schema.properties) return Object.keys(schema.properties).length > 0;
    return schema.type !== undefined && schema.type !== 'object';
  };

  return Object.entries(document.paths).flatMap(([path, item]) =>
    METHODS.flatMap((method) => {
      const operation: OperationObject | undefined = item[method];
      if (!operation) return [];
      const { responses } = operation;
      // sem 2xx, o plugin não documentou a resposta: um @ApiProblemResponse desliga a inferência
      if (!Object.keys(responses).some((status) => status.startsWith('2'))) {
        return [`${method.toUpperCase()} ${path} 2xx`];
      }
      return STATUSES_WITH_BODY.filter((status) => status in responses)
        .filter((status) => {
          const response = responses[status];
          const content =
            response && 'content' in response ? Object.values(response.content ?? {}) : [];
          return !content.some((media) => isDocumented(media.schema));
        })
        .map((status) => `${method.toUpperCase()} ${path} ${status}`);
    }),
  );
}
