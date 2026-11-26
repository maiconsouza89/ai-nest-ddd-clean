import { describe, it, expect, vi, afterEach } from 'vitest';
import { emailsTo } from './mailpit.js';

describe('emailsTo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  /** Troca o `fetch` e devolve a origem e a busca (o `query` decodificado) de cada chamada. */
  function stubFetch() {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(() =>
      Promise.resolve(new Response(JSON.stringify({ messages: [] }))),
    );
    vi.stubGlobal('fetch', fetchMock);
    return () => {
      const url = new URL(fetchMock.mock.calls[0][0]);
      return { origin: url.origin, search: url.searchParams.get('query') };
    };
  }

  it('no Mailpit compartilhado, com MAILPIT_TAG, busca pela tag e pelo destinatário', async () => {
    vi.stubEnv('MAILPIT_TAG', 'wt3');
    const request = stubFetch();

    await emailsTo('ana@example.com');

    expect(request().search).toBe('tag:"wt3" to:"ana@example.com"');
  });

  it('numa API passada pelo teste, busca só pelo destinatário, mesmo com MAILPIT_TAG', async () => {
    vi.stubEnv('MAILPIT_TAG', 'wt3');
    const request = stubFetch();

    await emailsTo('ana@example.com', 'http://127.0.0.1:18025');

    expect(request()).toEqual({
      origin: 'http://127.0.0.1:18025',
      search: 'to:"ana@example.com"',
    });
  });

  it('no Mailpit compartilhado, sem MAILPIT_TAG, busca só pelo destinatário', async () => {
    vi.stubEnv('MAILPIT_TAG', undefined);
    const request = stubFetch();

    await emailsTo('ana@example.com');

    expect(request().search).toBe('to:"ana@example.com"');
  });
});
