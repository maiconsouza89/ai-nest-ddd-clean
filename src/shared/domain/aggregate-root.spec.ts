import { AggregateRoot } from './aggregate-root';
import { DomainEvent } from './domain-event';

class Happened implements DomainEvent {
  readonly type = 'Happened';
}

class Sample extends AggregateRoot {
  doIt() {
    this.record(new Happened());
  }
}

describe('AggregateRoot', () => {
  it('registra eventos em ordem e esvazia a lista ao puxar', () => {
    const sample = new Sample();
    sample.doIt();
    sample.doIt();

    expect(sample.pullEvents()).toHaveLength(2);
    expect(sample.pullEvents()).toEqual([]);
  });
});
