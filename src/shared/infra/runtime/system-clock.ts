import { Clock } from '../../application/ports/clock.js';

export class SystemClock implements Clock {
  now() {
    return new Date();
  }
}
