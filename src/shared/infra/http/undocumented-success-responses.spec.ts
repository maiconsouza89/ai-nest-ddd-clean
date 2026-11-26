import { describe, it, expect } from 'vitest';
import type { OpenAPIObject, ResponseObject } from '@nestjs/swagger';
import { findUndocumentedSuccessResponses } from './undocumented-success-responses.js';

const json = (schema: object): ResponseObject => ({
  description: '',
  content: { 'application/json': { schema } },
});

const documentWith = (responses: Record<string, ResponseObject>): OpenAPIObject => ({
  openapi: '3.0.0',
  info: { title: 'teste', version: '1' },
  paths: { '/v1/things': { post: { responses } } },
  components: {
    schemas: {
      Thing: { type: 'object', properties: { id: { type: 'string' } } },
      Empty: { type: 'object', properties: {} },
      Node: {
        type: 'object',
        properties: {
          children: { type: 'array', items: { $ref: '#/components/schemas/Node' } },
        },
      },
    },
  },
});

describe('findUndocumentedSuccessResponses', () => {
  it.each([
    ['sem content', { description: '' }],
    ['com { type: object } sem propriedades', json({ type: 'object' })],
    ['com $ref para schema sem propriedades', json({ $ref: '#/components/schemas/Empty' })],
    ['com $ref para schema que não existe', json({ $ref: '#/components/schemas/Missing' })],
    ['com array de itens sem schema', json({ type: 'array', items: { type: 'object' } })],
    [
      'com allOf em que um ramo tem itens sem schema',
      json({
        allOf: [
          { $ref: '#/components/schemas/Thing' },
          {
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/Empty' } },
            },
          },
        ],
      }),
    ],
    [
      'com propriedade que aponta para schema sem propriedades',
      json({ type: 'object', properties: { item: { $ref: '#/components/schemas/Empty' } } }),
    ],
  ])('acusa a resposta %s', (_, response) => {
    expect(findUndocumentedSuccessResponses(documentWith({ '201': response }))).toEqual([
      'POST /v1/things 201',
    ]);
  });

  it.each([
    ['com $ref para schema com propriedades', json({ $ref: '#/components/schemas/Thing' })],
    [
      'com allOf de $ref e itens documentados',
      json({
        allOf: [
          { $ref: '#/components/schemas/Thing' },
          {
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/Thing' } },
            },
          },
        ],
      }),
    ],
    ['com schema recursivo', json({ $ref: '#/components/schemas/Node' })],
    [
      'com propriedade só de exemplo',
      json({ type: 'object', properties: { status: { example: 'ok' } } }),
    ],
    ['com array de $ref', json({ type: 'array', items: { $ref: '#/components/schemas/Thing' } })],
    ['com propriedades', json({ type: 'object', properties: { ok: { type: 'boolean' } } })],
    ['com tipo primitivo', json({ type: 'string' })],
  ])('aceita a resposta %s', (_, response) => {
    expect(findUndocumentedSuccessResponses(documentWith({ '200': response }))).toEqual([]);
  });

  it('acusa a operação sem resposta de sucesso', () => {
    const document = documentWith({ '401': json({ type: 'object' }) });
    expect(findUndocumentedSuccessResponses(document)).toEqual(['POST /v1/things 2xx']);
  });

  it('não confere os status sem corpo nem os de erro', () => {
    const document = documentWith({
      '202': { description: '' },
      '204': { description: '' },
      '400': json({ type: 'object' }),
    });
    expect(findUndocumentedSuccessResponses(document)).toEqual([]);
  });
});
