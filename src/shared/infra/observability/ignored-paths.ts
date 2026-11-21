/** Sondas de orquestrador: ficam de fora dos logs de requisição e dos traces. */
export const isHealthRequest = (url: string | undefined) => {
  const path = (url ?? '').split('?')[0];
  return path === '/health' || path.startsWith('/health/');
};
