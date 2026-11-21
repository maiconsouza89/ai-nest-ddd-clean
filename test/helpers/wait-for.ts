/** Consulta a condição até ela valer ou estourar o tempo. */
export async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 15_000) {
  const start = Date.now();
  while (!(await condition())) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout esperando a condição');
    await new Promise((r) => setTimeout(r, 100));
  }
}
