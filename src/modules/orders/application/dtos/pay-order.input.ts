import { OrderActionInput } from './order-action.input';

export type PayOrderInput = OrderActionInput & { idempotencyKey?: string };
