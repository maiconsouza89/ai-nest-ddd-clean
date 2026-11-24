import { Actor } from '#shared/application/actor';
import { Order } from '../domain/entities/order.entity.js';
import { NotOrderOwnerError } from '../domain/errors/not-order-owner.error.js';
import { OrderNotFoundError } from '../domain/errors/order-not-found.error.js';
import { OrderRepository } from '../domain/repositories/order.repository.js';

/** A regra de acesso a um pedido, nas ações e na leitura: o dono ou um admin. */
export function assertCanAccessOrder(actor: Actor, customerId: string) {
  const isAdmin = actor.roles.includes('admin');
  if (customerId !== actor.id && !isAdmin) throw new NotOrderOwnerError();
}

export async function loadOwnedOrder(
  repo: OrderRepository,
  orderId: string,
  actor: Actor,
  { lock = false }: { lock?: boolean } = {},
): Promise<Order> {
  const order = await (lock ? repo.findByIdForUpdate(orderId) : repo.findById(orderId));
  if (!order) throw new OrderNotFoundError();
  assertCanAccessOrder(actor, order.customerId);
  return order;
}
