---
status: accepted
---

# Imports explícitos entre módulos, sem `@Global`

Os módulos de negócio que expõem uma facade (`catalog`, `inventory` e `identity`) deixam de ser `@Global`. Os módulos que os consomem passam a importá-los de forma explícita: `OrdersModule` importa `CatalogModule` e `InventoryModule`, e `NotificationsModule` importa `IdentityModule`.

Segundo a doc do Nest, os `exports` de um `@Module` são a API pública dele. O `@Global` serve para infraestrutura transversal (banco, relógio, observabilidade), e não para módulos de negócio. Como cada módulo exporta só a facade, importá-lo não dá acesso a nada além dela.

O dependency-cruiser continua proibindo qualquer import entre módulos fora de `contracts/`, com uma única exceção: um `*.module.ts` pode importar o `*.module.ts` de outro módulo. Isso não é um furo na fronteira. O arquivo do módulo Nest é o mecanismo de encapsulamento do próprio framework.

## Considered Options

- **Manter o `@Global` e documentar a troca:** a dependência ficava invisível no `imports` de quem a usa.
- **Mover o arquivo do módulo Nest para a raiz de cada módulo:** a exceção da regra ficaria mais simples, mas seria preciso mover arquivos de quatro módulos e do template do plop sem ganho real.
