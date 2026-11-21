// API pública do catalog: só tipos primitivos.
export type ProductPrice = { productId: string; priceCents: number; currency: string };

export abstract class CatalogFacade {
  /** Devolve só os produtos que existem; ids desconhecidos ficam de fora. */
  abstract pricesOf(productIds: string[]): Promise<ProductPrice[]>;
}
