import { ProcessedEvents } from '../../src/shared/application/ports/processed-events';

export class FakeProcessedEvents implements ProcessedEvents {
  private readonly marks = new Set<string>();

  async tryMark(eventId: string, consumer: string) {
    const key = `${consumer}:${eventId}`;
    if (this.marks.has(key)) return false;
    this.marks.add(key);
    return true;
  }
}
