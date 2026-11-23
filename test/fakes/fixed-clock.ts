import { Clock } from '#shared/application/ports/clock';

// Parado no tempo até o teste mandar avançar.
export class FixedClock implements Clock {
  constructor(private date = new Date('2026-01-01T12:00:00.000Z')) {}

  now() {
    return this.date;
  }

  advance(ms: number) {
    this.date = new Date(this.date.getTime() + ms);
  }
}
