---
type: explanation
---

# Modelagem do domínio

Por que o dinheiro é um inteiro em centavos, por que o id e a hora chegam por ports, por que os erros são exceptions com um `code`, por que a mesma regra é validada em mais de um lugar e o que fazer com regras e dados que não cabem num agregado. Em qual pasta fica cada peça está em [Camadas](../reference/camadas.md#domain).

## Contexto

O domínio é TypeScript puro, sem Nest e sem banco, e roda nos testes unitários sem nada de fora ([Arquitetura](arquitetura.md)). Ele recebe dados de vários lugares: do HTTP, do banco ao reconstruir um agregado, de jobs e de eventos de outros módulos. Algumas escolhas de representação valem para todos os módulos: o dinheiro, os ids, a hora e os erros. Os blocos comuns ficam no `shared` ([Shared kernel](shared-kernel.md)).

## Por quê

### Dinheiro em centavos inteiros

Em ponto flutuante, `0.1 + 0.2` dá `0.30000000000000004`. Somas de preço erram por frações de centavo, e a comparação de totais falha. O `Money` guarda um inteiro na menor unidade da moeda (centavos, no real) e a moeda:

```ts
// shared/domain/money.vo.ts
static fromCents(cents: number, currency = 'BRL') {
  if (!Number.isSafeInteger(cents)) throw new InvalidMoneyError();
  return new Money(cents, currency);
}

add(o: Money) {
  this.assertSameCurrency(o);
  return new Money(this.cents + o.cents, this.currency);
}
```

O `Number.isSafeInteger` também barra um valor grande demais para o `number` do JavaScript. No banco, o preço do item fica em duas colunas: `unitPriceCents`, em `bigint`, e `currency`. O driver do Postgres devolve o `bigint` como texto, e o mapper o converte com `Number` antes do `fromCents` ([Persistência](persistencia.md)).

Somar moedas diferentes é erro (`CURRENCY_MISMATCH`), e não uma conversão implícita. Converter exige uma cotação e uma data, e essa é uma decisão de negócio que o `Money` não tem como tomar.

O `Money` não tem divisão. Para dividir um valor em parcelas ou num rateio, o caminho é um método `allocate` que distribui os centavos que sobram. Dividir e arredondar cada parte faz a soma não fechar: R$ 1,00 em três partes dá 33 + 33 + 33 = 99 centavos, e o `allocate` devolveria 34 + 33 + 33.

### O id e a hora chegam por ports

O caso de uso não chama `new Date()` nem gera UUID direto. Ele recebe um `Clock` e um `IdGenerator` no construtor:

```ts
export abstract class Clock {
  abstract now(): Date;
}

export abstract class IdGenerator {
  abstract next(): string;
}
```

Na aplicação, o `SystemClock` devolve a hora do sistema e o `UuidV7Generator` gera UUID v7. Nos testes, o `FixedClock` fica parado até o teste mandar avançar (`advance`), e o `SequentialIdGenerator` devolve `order-1`, `order-2`. Assim, o teste da sessão avança o relógio para vencer um token sem esperar, e os testes comparam ids fixos em vez de aceitar qualquer string.

O id nasce na application, e não no banco. O agregado tem id desde o `create`, antes do `save`, e o evento que vai para a outbox na mesma transação já sai com ele.

O UUID v7 começa pelo instante da criação. Um id novo cai no fim do índice B-tree, enquanto o v4, aleatório, espalha as inserções por todas as páginas do índice. A RFC 9562, que padronizou o v7, cita essa baixa localidade do v4 como motivo para preferir as versões ordenadas por tempo. A ordem por criação também deixa o id servir de cursor numa listagem ([Como paginar uma listagem](../how-to/paginar-uma-listagem.md#lista-grande-ou-rolagem-infinita-cursor)).

### Erros são exceptions com um `code`

Todo erro de domínio estende o `DomainError` e declara um `code` estável, como `ORDER_ALREADY_PAID`:

```ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(message?: string) {
    super(message);
    this.name = new.target.name;
  }
}
```

O domínio não conhece HTTP. Cada módulo declara o status de cada `code` num mapa, o `<MÓDULO>_ERROR_STATUSES` de `infra/http/error-statuses.ts`, e o registra ao subir. Um filtro global do `shared` monta a resposta em Problem Details, com o `code` como extensão ([Respostas de erro](../reference/respostas-de-erro.md)). Um `code` fora do mapa responde 422. O cliente pode depender do `code`. A mensagem, que sai no `detail`, é para leitura e pode mudar.

A exception interrompe o caso de uso no primeiro erro, sem que cada chamada confira um retorno. Um erro lançado dentro do `tx.run` também desfaz a transação ([Consistência e eventos](consistencia-e-eventos.md#a-transação-vai-pelo-contexto-e-não-pelos-parâmetros)). O custo é que o erro não aparece na assinatura do método. Quem lê descobre os erros possíveis pelo mapa de status do módulo e pelos testes.

Entre módulos vale o contrário: a facade devolve um resultado (`{ ok: false, reason }`), porque a classe de erro do domínio de um módulo não faz parte do contrato público dele ([Comunicação entre módulos](comunicacao-entre-modulos.md)).

### A mesma regra validada em mais de um lugar

Cada tipo de regra tem um lugar ([Camadas](../reference/camadas.md#domain)): o formato no DTO HTTP, a invariante na entidade ou no value object, e a regra que depende de dados no caso de uso. Às vezes a mesma regra aparece em dois lugares, e de propósito.

O DTO protege só a rota HTTP. Jobs, handlers de eventos e testes chamam o domínio sem passar por ele. Por isso a quantidade de um item é conferida no `CreateOrderRequest` (`@IsInt()`, `@Min(1)`), que devolve 400 com o campo errado, e de novo no `OrderItem`, que lança `InvalidQuantityError` para uma quantidade que não é inteira ou não é positiva, venha de onde vier.

A regra que depende de dados tem o mesmo desenho por outro motivo. O `RegisterUserUseCase` procura o e-mail antes de criar a conta e lança `EmailAlreadyInUseError`. Duas requisições simultâneas passam juntas por essa checagem, e quem decide é o `UNIQUE` da tabela. O repositório traduz a violação de unicidade para o mesmo `EmailAlreadyInUseError`. A checagem do caso de uso dá o erro claro no caso comum, e a constraint garante a regra na concorrência.

### Regra que envolve mais de um agregado: domain service

Uma regra que precisa de dados de dois agregados, e não pertence a nenhum deles, vira um domain service: uma classe pura em `domain/services/`, que recebe os dados prontos e não acessa repositório. O caso de uso carrega os dados e chama o serviço. O projeto não tem nenhum. Um desconto pelo nível do cliente seria um exemplo:

```ts
// exemplo: não existe no projeto
export class DiscountPolicy {
  calculate(order: Order, tier: CustomerTier): Money {
    if (tier === 'GOLD' && order.total.cents >= 50_000) {
      return Money.fromCents(Math.round(order.total.cents * 0.1));
    }
    return Money.zero();
  }
}
```

Sem repositório, o serviço é testado com dados montados no teste, e o acesso a dados continua todo no caso de uso. Uma regra que cabe numa entidade fica na entidade. Mover para serviços o que a entidade poderia decidir esvazia a entidade, que vira só um saco de dados.

### Excluir é mudar de estado

Cancelar um pedido é uma regra de negócio. O `order.cancel()` só aceita um pedido em `DRAFT` ou `PLACED`, porque um pedido pago exigiria estorno. Ele muda o status e anota o `OrderCancelled`, que o inventory consome para devolver o estoque. Uma coluna `deletedAt` esconderia o pedido das consultas, mas perderia a regra de quando ele pode ser cancelado e o evento de que outro módulo depende. Por isso uma exclusão com significado de negócio é modelada como estado do domínio.

O soft delete técnico serve a outro caso: recuperar um registro apagado por engano. O TypeORM o oferece com o `@DeleteDateColumn` e o `softDelete()`, e acrescenta `deletedAt IS NULL` às consultas do repositório e do query builder, a menos que a consulta peça `withDeleted`. O SQL escrito à mão, como o da busca do relay da outbox, não ganha esse filtro. O projeto não usa soft delete.

### Datas de auditoria ficam na infra

O `createdAt` e o `updatedAt` são colunas da ORM entity (`@CreateDateColumn`, `@UpdateDateColumn`), e o `Order` do domínio não os tem. Mesmo a expiração de pedidos parados, que depende do `updatedAt`, não o leva ao domínio: o caso de uso calcula o limite pelo `Clock` e o repositório filtra pela coluna (`findStaleIds(cutoff, limit)`). O campo só entra na entidade quando uma regra do próprio agregado depender dele.

Quem criou ou alterou um registro (`createdBy`) não é guardado. Há dois caminhos:

- **O caso de uso repassa o ator:** ele já recebe o `Actor` na entrada. O dado fica visível na assinatura e nos testes, ao custo de mudar a assinatura do repositório.
- **Um subscriber do TypeORM preenche:** o campo é preenchido sem mudar nenhum caso de uso, mas o subscriber precisa achar o ator num contexto por requisição, com `AsyncLocalStorage` ou com o `nestjs-cls`. O único contexto do projeto é o da transação. Um job também não tem requisição nem ator.

O histórico completo das mudanças sairia dos eventos de domínio: um consumidor grava cada evento numa tabela de auditoria.

## Alternativas e trade-offs

- **`numeric(12,2)` no banco:** o Postgres guarda o decimal exato, mas o driver o devolve como texto, e a conta em `number` volta a ser ponto flutuante. Seria preciso uma biblioteca decimal em todo o código que faz conta. O inteiro em centavos usa o `number` nativo e vai até 2⁵³ centavos, um limite que o projeto não alcança.
- **Result ou Either no lugar de exceptions:** o erro aparece no tipo de retorno e o compilador obriga a tratá-lo. Em troca, cada chamada confere o resultado, e o caso de uso precisa lançar de qualquer jeito para o `tx.run` desfazer a transação. O projeto usa o resultado só na facade entre módulos.
- **Id gerado pelo banco (`serial` ou `identity`):** o id só existe depois do insert, e o evento não o teria ao ser anotado no agregado. O número sequencial também revela quantos registros existem. O UUID v4 resolve os dois, mas perde a localidade no índice.
- **Validar só no DTO:** menos código, mas o domínio fica aberto para qualquer entrada que não passe pelo HTTP.
- **Soft delete em toda tabela:** um registro apagado nunca se perde, mas cada consulta escrita à mão precisa lembrar do filtro. As linhas apagadas também continuam ocupando o `UNIQUE`: um e-mail de conta apagada impediria um cadastro novo com o mesmo e-mail.

## Decisões relacionadas

Não há ADR para estas escolhas: o porquê está nesta página. O domain service, o `createdBy` e o `allocate` só entram quando a necessidade aparecer.
