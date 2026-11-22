import { Money } from '#shared/domain/money.vo';
import { InvalidQuantityError } from '../errors/invalid-quantity.error.js';

export class OrderItem {
  constructor(
    readonly productId: string,
    private _qty: number,
    readonly unitPrice: Money,
  ) {
    if (!Number.isInteger(_qty) || _qty <= 0) throw new InvalidQuantityError();
  }

  get qty() {
    return this._qty;
  }

  get subtotal() {
    return this.unitPrice.times(this._qty);
  }

  increase(qty: number) {
    if (!Number.isInteger(qty) || qty <= 0) throw new InvalidQuantityError();
    this._qty += qty;
  }
}
