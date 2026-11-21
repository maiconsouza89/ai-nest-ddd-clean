import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { Money } from '../../../../shared/domain/money.vo';
import { EmptyOrderError } from '../errors/empty-order.error';
import { OrderCancelled } from '../events/order-cancelled.event';
import { OrderCreated } from '../events/order-created.event';
import { OrderPaid } from '../events/order-paid.event';
import { OrderPlaced } from '../events/order-placed.event';
import { OrderAlreadyPaidError } from '../errors/order-already-paid.error';
import { OrderNotCancellableError } from '../errors/order-not-cancellable.error';
import { OrderNotEditableError } from '../errors/order-not-editable.error';
import { OrderNotPayableError } from '../errors/order-not-payable.error';
import { OrderStatus } from '../value-objects/order-status.vo';
import { OrderItem } from './order-item.entity';

export type OrderProps = {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  version: number;
};

export class Order extends AggregateRoot {
  private constructor(
    readonly id: string,
    readonly customerId: string,
    private _items: OrderItem[],
    private _status: OrderStatus,
    // versão lida do banco, usada na checagem de concorrência otimista
    readonly version: number,
  ) {
    super();
  }

  static create(id: string, customerId: string) {
    const order = new Order(id, customerId, [], OrderStatus.DRAFT, 0);
    // só `create` anota: `restore` recarrega um pedido que já existe e não é um fato novo
    order.addDomainEvent(new OrderCreated(id, customerId));
    return order;
  }

  static restore(p: OrderProps) {
    return new Order(p.id, p.customerId, p.items, p.status, p.version);
  }

  get status() {
    return this._status;
  }

  get items(): readonly OrderItem[] {
    return [...this._items];
  }

  get total() {
    return this._items.reduce((sum, i) => sum.add(i.subtotal), Money.zero());
  }

  addItem(productId: string, qty: number, unitPrice: Money) {
    if (this._status !== OrderStatus.DRAFT) throw new OrderNotEditableError();
    const existing = this._items.find((i) => i.productId === productId);
    if (existing) existing.increase(qty);
    else this._items.push(new OrderItem(productId, qty, unitPrice));
  }

  place() {
    if (this._status !== OrderStatus.DRAFT) throw new OrderNotEditableError();
    if (this._items.length === 0) throw new EmptyOrderError();
    this._status = OrderStatus.PLACED;
    this.addDomainEvent(new OrderPlaced(this.id, this.customerId));
  }

  pay() {
    if (this._status === OrderStatus.PAID) throw new OrderAlreadyPaidError();
    if (this._status !== OrderStatus.PLACED) throw new OrderNotPayableError();
    this._status = OrderStatus.PAID;
    // avisa os outros módulos; só sai se o caso de uso salvar e gravar na outbox
    this.addDomainEvent(
      new OrderPaid(this.id, this.customerId, this.total.cents, this.total.currency),
    );
  }

  cancel() {
    // pago exigiria estorno, e cancelado já foi cancelado
    if (this._status !== OrderStatus.DRAFT && this._status !== OrderStatus.PLACED) {
      throw new OrderNotCancellableError();
    }
    this._status = OrderStatus.CANCELLED;
    // o inventory reage a este evento para repor o estoque
    this.addDomainEvent(new OrderCancelled(this.id, this.customerId));
  }

  isOwnedBy(userId: string) {
    return this.customerId === userId;
  }
}
