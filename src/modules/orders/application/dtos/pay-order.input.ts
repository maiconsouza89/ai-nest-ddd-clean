import { OrderActionInput } from './order-action.input.js';

export type PayOrderInput = OrderActionInput & { idempotencyKey?: string };
