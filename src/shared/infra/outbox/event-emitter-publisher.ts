import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IntegrationEvent } from '../../application/integration-event';
import { EventPublisher } from '../../application/ports/event-publisher';

// Barramento em memória. Trocar por RabbitMQ ou Kafka muda só esta classe.
// Os handlers precisam de `@OnEvent(tipo, { suppressErrors: false })`; do contrário o erro
// some e o worker marca o evento como entregue.
@Injectable()
export class EventEmitterPublisher implements EventPublisher {
  constructor(private readonly emitter: EventEmitter2) {}

  async publish(event: IntegrationEvent) {
    await this.emitter.emitAsync(event.type, event);
  }
}
