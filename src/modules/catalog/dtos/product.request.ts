import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

// int de 32 bits no banco
const MAX_PRICE_CENTS = 1_000_000_000;

export class CreateProductRequest {
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
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  priceCents?: number;
}
