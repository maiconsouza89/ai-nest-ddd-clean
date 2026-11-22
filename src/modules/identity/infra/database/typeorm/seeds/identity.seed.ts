import type { DataSource } from 'typeorm';
import { Argon2PasswordHasher } from '../../../adapters/argon2-password-hasher.js';
import { UserOrmEntity } from '../entities/user.orm-entity.js';

// Só para desenvolvimento: senha conhecida de propósito.
export const SEED_PASSWORD = 'Senha@12345';

export const SEED_USERS = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'admin@example.com',
    name: 'Admin',
    roles: ['admin'],
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    email: 'user@example.com',
    name: 'Usuário',
    roles: [] as string[],
  },
];

export async function seedIdentity(ds: DataSource): Promise<void> {
  const passwordHash = await new Argon2PasswordHasher().hash(SEED_PASSWORD);
  // insere só quem falta: rodar de novo não troca id, roles nem senha de conta existente
  await ds
    .getRepository(UserOrmEntity)
    .createQueryBuilder()
    .insert()
    .values(SEED_USERS.map((u) => ({ ...u, passwordHash })))
    .orIgnore()
    .execute();
}
