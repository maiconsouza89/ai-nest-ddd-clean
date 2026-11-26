---
type: explanation
---

# Persistência

Por que a entidade de domínio e a entidade do TypeORM são classes diferentes, o que isso custa, por que a leitura não passa pelo agregado, e por que a conexão com o Postgres tem pool e timeouts limitados. As regras de escrita das ORM entities estão em [Convenções](../reference/convencoes.md#typeorm), e a pasta de cada peça em [Camadas](../reference/camadas.md#infra).

## Contexto

O domain não importa o TypeORM ([Arquitetura](arquitetura.md#nest-e-typeorm-só-na-infra)). Mas o TypeORM descreve tabelas com decorators na própria classe (`@Entity`, `@Column`, `@OneToMany`). Uma classe só não serve aos dois: ou o domain ganha decorators do TypeORM, ou a tabela perde a descrição.

Por isso cada agregado tem dois modelos. A entidade de domínio (`Order`) guarda as regras. A ORM entity (`OrderOrmEntity`, em `infra/database/typeorm/entities/`) descreve a tabela. Um mapper converte entre os dois, e só o repositório concreto o usa.

Abaixo do repositório fica a conexão. Todos os módulos dividem um pool de conexões com o Postgres por processo, e o driver `pg`, sem configuração, espera sem limite por uma conexão livre, por uma query e por uma transação esquecida aberta. Uma espera dessas num ponto lento prende conexões até o pool acabar, e aí a API inteira para, e não só a rota lenta.

## Por quê

### O repositório devolve sempre o domínio

O contrato do repositório fala de `Order`, e o repositório concreto traduz na borda:

```ts
@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(private readonly dataSource: DataSource) {}

  // usa a transação ativa, se houver
  private get repo() {
    return currentManager(this.dataSource).getRepository(OrderOrmEntity);
  }

  async findById(id: string) {
    const raw = await this.repo.findOne({ where: { id }, relations: { items: true } });
    return raw ? OrderMapper.toDomain(raw) : null;
  }
  // ...
}
```

Se a ORM entity vazasse para a application, o caso de uso passaria a depender do formato da tabela, e o domínio perderia o controle das próprias regras: qualquer um poderia mudar o `status` de uma ORM entity e salvar.

### O mapper reconstrói sem repetir regras

O mapper chama `Order.restore`, não `Order.create`. O pedido salvo já passou pelas regras de criação, e o evento `OrderCreated` já foi anotado quando ele nasceu:

```ts
export class OrderMapper {
  static toDomain(raw: OrderOrmEntity): Order {
    return Order.restore({
      id: raw.id,
      customerId: raw.customerId,
      status: raw.status as OrderStatus,
      version: raw.version,
      items: raw.items.map(
        (i) =>
          new OrderItem(i.productId, i.qty, Money.fromCents(Number(i.unitPriceCents), i.currency)),
      ),
    });
  }
  // toPersistence faz o caminho inverso
}
```

O mapper também é o lugar das diferenças de formato: o preço é `Money` no domínio e duas colunas (`unitPriceCents` em `bigint`, `currency`) na tabela.

### O repositório grava na transação do caso de uso

O repositório pega o `EntityManager` da transação ativa (`currentManager`) a cada chamada, em vez de receber um `Repository` por `@InjectRepository`. O caso de uso abre a transação pelo port `TransactionManager`, sem conhecer o TypeORM, e tudo o que os repositórios gravam dentro dela entra junto. Um `Repository` injetado ficaria preso à conexão padrão e gravaria fora da transação, sem erro.

### Trocar de ORM muda só a infra

Para trocar o TypeORM por outro ORM (Prisma, por exemplo), mudam o repositório concreto, o mapper, o modelo de banco e o `useClass` no módulo Nest. Domain, casos de uso e controller continuam iguais. A troca é improvável, mas o mesmo isolamento serve no dia a dia: uma mudança de tabela fica no mapper e não se espalha pelas regras.

### Pool e timeouts

Cada uma das três esperas sem limite do `pg` ganha um prazo, e cada prazo devolve a conexão ao pool. Com o pool esgotado, toda requisição que toca o banco fica parada, inclusive as rápidas. Os limites e os padrões estão em [Variáveis de ambiente](../reference/variaveis-de-ambiente.md); a app e os DataSources da CLI os recebem da mesma função, `postgresOptions`.

- **Fila do pool:** com as conexões todas em uso, quem pede uma entra numa fila. Sem prazo, a requisição espera para sempre, e é assim que algumas chamadas lentas a um fornecedor derrubam a API inteira ([Serviços externos](servicos-externos.md#timeout-em-toda-chamada)). Com o `DATABASE_CONNECT_TIMEOUT_MS`, de alguns segundos e acima do ping da readiness, o pedido falha e a requisição responde 500, em vez de acumular.
- **Query presa:** uma query sem fim segura a conexão. O `statement_timeout`, de dezenas de segundos, faz o servidor cancelá-la. É um teto contra o caso patológico, não uma meta de latência. A espera por lock conta dentro dele, por isso a app não usa `lock_timeout`.
- **Transação esquecida aberta:** um código que abre a transação e não fecha segura a conexão e os locks das linhas que tocou. O `idle_in_transaction_session_timeout`, da ordem de um minuto, faz o servidor encerrar a sessão. O limite fica bem acima dos poucos segundos em que o pagamento segura a transação durante a chamada ao fornecedor ([Transações e concorrência](transacoes-e-concorrencia.md#trava-pessimista-quando-o-efeito-não-se-desfaz)).

Os dois timeouts de query vão como parâmetros da conexão, que o servidor aplica à sessão. Valem do mesmo jeito para o TypeORM, para uma query crua e para a transação aberta pelo `TransactionManager`.

**As migrations e os seeds rodam sem os dois timeouts de query.** Um `CREATE INDEX` ou um backfill que leva segundos no dev, com pouco dado, pode levar minutos em produção, e cancelá-lo no meio do deploy deixa o passo de migration falhando sem que nada esteja errado. O pool e o prazo de conexão continuam iguais.

**O SSL fica só na `DATABASE_URL`.** No `pg`, o `sslmode` da URL vence o `ssl` do config. Uma variável própria seria uma segunda fonte de verdade que perderia da URL sem aviso. O SSL também não é obrigatório em produção: isso quebraria o profile `prod` do `docker-compose.yml` e os bancos em rede privada.

**Atrás do PgBouncer em modo transaction, os limites de query passam para o role do banco.** O PgBouncer recusa os parâmetros de conexão que não acompanha, e a app manda os dois timeouts de query justamente como parâmetros da conexão. Por isso, atrás dele, a app deixa de mandá-los e o role do banco aplica os mesmos limites a toda sessão. O passo de migration usa um role à parte, sem o `statement_timeout`, pelo mesmo motivo que as migrations rodam sem ele. Os passos estão em [Como fazer o deploy](../how-to/fazer-o-deploy.md).

### Leitura sem agregado (CQRS leve)

As gravações passam pelo agregado e pelo repositório, porque é ali que ficam as invariantes, a versão e os eventos. A leitura não muda estado e não precisa de nada disso. A `OrderQueries` vai direto ao banco com query builder e devolve um DTO no formato da tela, com a paginação e o filtro pelo ator ([Camadas](../reference/camadas.md#application)).

Separar as duas abre espaço para o cache da listagem, que envolve a query e é descartado por um consumidor dos eventos do pedido. É só uma separação no código: a leitura vem do mesmo banco e da mesma tabela, e por isso enxerga a gravação assim que ela confirma.

## Alternativas e trade-offs

- **Uma classe só, com os decorators do TypeORM na entidade de domínio:** economiza a ORM entity e o mapper, e é o que a documentação do TypeORM mostra. Em troca, o domain importa o TypeORM, o que o `npm run arch` barra, e o formato da tabela passa a moldar a entidade de domínio.
- **Active Record (`BaseEntity` do TypeORM):** a entidade salva a si mesma (`order.save()`). É direto em CRUD, mas mistura regra de negócio e acesso ao banco na mesma classe, e o caso de uso deixa de controlar quando e em qual transação se grava. O [catalog](../reference/modules/catalog.md#estrutura), que é CRUD, usa o `Repository` do TypeORM direto, sem Active Record.
- **`query_timeout` do `pg`:** desiste da query no cliente e a deixa rodando no servidor, segurando o que ela trava. O `statement_timeout` cancela no servidor.
- **`lock_timeout` na app:** a espera por lock já conta no `statement_timeout`. Nas migrations ele faria sentido, para uma migration não travar o tráfego da app esperando lock, e está em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#infraestrutura-e-dados).
- **Uma resposta própria para os timeouts do banco:** pool cheio e query cancelada respondem 500 pelo filtro genérico. Um 503 com `code` próprio também está em [Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#infraestrutura-e-dados).
- **CQRS completo, com modelo e banco de leitura separados:** escala leitura e escrita de forma independente. Em troca, a leitura fica eventualmente consistente, e cada mudança de tela exige atualizar uma projeção. Só compensa com um volume ou um formato de leitura que o banco de escrita não atende.
- **O custo do caminho escolhido:** dois modelos e um mapper por agregado, e um teste a mais para o mapeamento. No `toDomain`, o `restore` exige todos os campos e o `tsc` acusa o que falta. No `toPersistence`, esquecer uma atribuição não dá erro de tipo (as colunas da ORM entity usam `!`) e só aparece no teste de integração do repositório (`typeorm-order.repository.int-spec.ts`).

## Decisões relacionadas

Nenhum ADR trata da persistência: o porquê está nesta página.
