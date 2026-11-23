import type { TestApp } from './test-app.js';
import { DataSource } from 'typeorm';
import { registerAndLogin, setRoles } from './auth.js';

/** Insere um produto no catalog, com estoque no inventory, direto no banco. Devolve o id. */
export async function seedProduct(app: TestApp, priceCents = 1000, stock = 100, name = 'Produto') {
  const id = crypto.randomUUID();
  await app
    .get(DataSource)
    .query(`INSERT INTO catalog.products (id, name, "priceCents") VALUES ($1, $2, $3)`, [
      id,
      name,
      priceCents,
    ]);
  await app
    .get(DataSource)
    .query(`INSERT INTO inventory.stock_items ("productId", available) VALUES ($1, $2)`, [
      id,
      stock,
    ]);
  return id;
}

/** Cadastra um usuário admin e devolve o header Authorization. */
export async function registerAdmin(app: TestApp) {
  const user = await registerAndLogin(app);
  await setRoles(app, user.id, ['admin']); // vale já no token emitido: o guard lê as roles do banco
  return user.auth;
}
