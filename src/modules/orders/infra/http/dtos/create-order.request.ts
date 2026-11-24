import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemRequest {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

export class CreateOrderRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemRequest)
  items!: CreateOrderItemRequest[];
}
