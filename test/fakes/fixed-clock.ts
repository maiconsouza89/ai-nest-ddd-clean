import { Clock } from '#shared/application/ports/clock';

export class FixedClock implements Clock {
  constructor(private readonly date = new Date('2026-01-01T12:00:00.000Z')) {}

  now() {
    return this.date;
  }
}
