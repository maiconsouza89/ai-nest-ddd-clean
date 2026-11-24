import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Trim } from '#shared/infra/http/trim.decorator';

// int de 32 bits no banco
const MAX_PRICE_CENTS = 1_000_000_000;

export class CreateProductRequest {
  @Trim()
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  priceCents!: number;
}

export class UpdateProductRequest {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  priceCents?: number;
}
