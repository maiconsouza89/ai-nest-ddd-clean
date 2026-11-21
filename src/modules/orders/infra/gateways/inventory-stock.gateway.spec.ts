import { describe, it, expect, vi } from 'vitest';
import { InventoryFacade } from '../../../inventory/contracts/inventory.facade';
import { InsufficientStockError } from '../../domain/errors/insufficient-stock.error';
import { InventoryStockGateway } from './inventory-stock.gateway';

describe('InventoryStockGateway', () => {
  const items = [{ productId: 'a', qty: 2 }];

  it('usa o id do pedido como referência da reserva', async () => {
    const reserve = vi.fn().mockResolvedValue({ ok: true });
    const gateway = new InventoryStockGateway({ reserve });

    await gateway.reserve('o1', items);

    expect(reserve).toHaveBeenCalledWith({ referenceId: 'o1', items });
  });

  it('converte falta de estoque em InsufficientStockError', async () => {
    const facade: InventoryFacade = {
      reserve: async () => ({ ok: false, reason: 'INSUFFICIENT_STOCK', productId: 'a' }),
    };

    await expect(new InventoryStockGateway(facade).reserve('o1', items)).rejects.toThrow(
      InsufficientStockError,
    );
  });
});
