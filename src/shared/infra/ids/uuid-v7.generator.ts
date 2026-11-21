import { v7 } from 'uuid';
import { IdGenerator } from '../../application/ports/id-generator';

export class UuidV7Generator implements IdGenerator {
  next() {
    return v7();
  }
}
