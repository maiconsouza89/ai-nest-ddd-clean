/**
 * Verifica que `actual` é compatível com o exemplo do contrato: todo campo do exemplo existe, com
 * o mesmo tipo, em qualquer profundidade. Campos a mais são permitidos (mudança aditiva).
 * Devolve a lista de divergências, vazia se compatível.
 */
export function incompatibilities(example: unknown, actual: unknown, path = '$'): string[] {
  if (example === null || typeof example !== 'object') {
    return typeof actual === typeof example
      ? []
      : [`${path}: esperado ${typeof example}, veio ${typeof actual}`];
  }
  if (actual === null || typeof actual !== 'object')
    return [`${path}: esperado objeto, veio ${typeof actual}`];
  return Object.entries(example).flatMap(([key, value]) =>
    key in actual
      ? incompatibilities(value, (actual as Record<string, unknown>)[key], `${path}.${key}`)
      : [`${path}.${key}: campo ausente`],
  );
}
