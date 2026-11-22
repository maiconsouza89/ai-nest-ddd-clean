import { IdGenerator } from '#shared/application/ports/id-generator';

export class SequentialIdGenerator implements IdGenerator {
  private n = 0;

  constructor(private readonly prefix = 'order') {}

  next() {
    return `${this.prefix}-${++this.n}`;
  }
}
