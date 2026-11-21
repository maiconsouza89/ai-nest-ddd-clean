import { Actor } from '../../../shared/application/actor';
import { Order } from '../domain/entities/order.entity';
import { NotOrderOwnerError } from '../domain/errors/not-order-owner.error';
import { OrderNotFoundError } from '../domain/errors/order-not-found.error';
import { OrderRepository } from '../domain/repositories/order.repository';

export async function loadOwnedOrder(
  repo: OrderRepository,
  orderId: string,
  actor: Actor,
): Promise<Order> {
  const order = await repo.findById(orderId);
  if (!order) throw new OrderNotFoundError();

  const isAdmin = actor.roles.includes('admin');
  if (!order.isOwnedBy(actor.id) && !isAdmin) throw new NotOrderOwnerError();
  return order;
}
