import { Injectable } from '@nestjs/common';
import { DataSource, IsNull, MoreThan } from 'typeorm';
import { currentManager } from '#shared/infra/database/transaction-context';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { RefreshTokenOrmEntity } from './entities/refresh-token.orm-entity.js';

@Injectable()
export class TypeOrmRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly dataSource: DataSource) {}

  // usa a transação ativa, se houver
  private get repo() {
    return currentManager(this.dataSource).getRepository(RefreshTokenOrmEntity);
  }

  async add(token: RefreshToken) {
    await this.repo.insert(token.toProps());
  }

  async findByHash(tokenHash: string) {
    // a relação `user` não é carregada, então a linha tem só as colunas das props
    const raw = await this.repo.findOneBy({ tokenHash });
    return raw ? RefreshToken.restore(raw) : null;
  }

  async markUsed(id: string, at: Date) {
    // Update condicional: o UPDATE trava a linha até o fim da transação. Uma renovação concorrente
    // espera a primeira terminar e então já não encontra `usedAt` nulo. As outras condições pegam
    // uma revogação (logout ou reuso) ou o vencimento que aconteceram depois da leitura do token.
    const { affected } = await this.repo.update(
      { id, usedAt: IsNull(), revokedAt: IsNull(), expiresAt: MoreThan(at) },
      { usedAt: at },
    );
    return affected === 1;
  }

  async revokeFamily(familyId: string, at: Date) {
    // Duas instruções, numa transação. O SELECT ... FOR UPDATE espera a renovação em andamento na
    // família (o markUsed dela trava a linha do token) e trava a família. Só depois o UPDATE tira
    // um snapshot novo, que já enxerga o sucessor que ela gravou; um UPDATE sozinho, sob READ
    // COMMITTED, não veria a linha inserida e ainda não confirmada.
    await this.repo
      .createQueryBuilder('t')
      .select('t.id')
      .where('t.familyId = :familyId', { familyId })
      .setLock('pessimistic_write')
      .getMany();
    await this.repo.update({ familyId, revokedAt: IsNull() }, { revokedAt: at });
  }

  async deleteExpired(now: Date, limit: number) {
    const [, affected] = await currentManager(this.dataSource).query<[unknown, number]>(
      `DELETE FROM "identity"."refresh_tokens" WHERE "id" IN (
         SELECT "id" FROM "identity"."refresh_tokens" WHERE "expiresAt" < $1 LIMIT $2
       )`,
      [now, limit],
    );
    return affected;
  }
}
