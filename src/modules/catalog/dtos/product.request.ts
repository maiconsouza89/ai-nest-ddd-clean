import { IsInt, IsString, Length, Max, Min, ValidateIf } from 'class-validator';
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

// Campo ausente não muda nada; `null` não é "ausente" (o @IsOptional deixaria passar e daria 500).
const IfPresent = () => ValidateIf((_, value) => value !== undefined);

export class UpdateProductRequest {
  @IfPresent()
  @Trim()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IfPresent()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  priceCents?: number;
}
