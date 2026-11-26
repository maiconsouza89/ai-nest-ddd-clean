import { ApiProperty } from '@nestjs/swagger';

export class ProductResponse {
  id!: string;

  name!: string;

  /** Preço em centavos. */
  @ApiProperty({ type: 'integer' })
  priceCents!: number;

  /** Código ISO 4217 da moeda. */
  currency!: string;

  createdAt!: Date;

  updatedAt!: Date;
}
