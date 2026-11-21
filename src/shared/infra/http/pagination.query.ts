import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

// Os padrões e o @Type só funcionam com ValidationPipe({ transform: true }).
export class PaginationQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
