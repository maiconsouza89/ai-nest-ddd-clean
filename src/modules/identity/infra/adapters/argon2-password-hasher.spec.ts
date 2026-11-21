import { Argon2PasswordHasher } from './argon2-password-hasher';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('gera um hash argon2id que não contém a senha e valida a senha certa', async () => {
    const hash = await hasher.hash('secret-123');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('secret-123');
    expect(await hasher.verify(hash, 'secret-123')).toBe(true);
  });

  it('rejeita senha errada e hash malformado', async () => {
    const hash = await hasher.hash('secret-123');
    expect(await hasher.verify(hash, 'other')).toBe(false);
    expect(await hasher.verify('not-a-hash', 'secret-123')).toBe(false);
  });
});
