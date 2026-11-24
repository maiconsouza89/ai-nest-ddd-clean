---
type: tutorial
---

# Do clone ao primeiro pedido

Neste tutorial você sobe a API na sua máquina e faz uma compra completa pela linha de comando: cadastra um usuário, entra, cria um pedido, fecha e paga.

## O que você vai construir

A API no ar com os produtos de exemplo, um usuário seu e um pedido pago. No fim, o log da app mostra o e-mail de confirmação que o módulo de notificações enviou sozinho, avisado pelo módulo de pedidos.

O teste `test/primeiro-pedido.e2e-spec.ts` segue os mesmos passos, na mesma ordem, e confere cada resposta.

## Pré-requisitos

- Node 22.13 ou superior e Docker ([Comandos](../reference/comandos.md#requisitos)).
- `curl` e um shell bash ou zsh.
- Nada rodando nas portas 3000, 5432 e 6379.
- Um ambiente limpo. Se você já subiu o projeto ou rodou os testes e2e, que gravam no mesmo banco, siga antes [Como resetar o ambiente local](../how-to/resetar-o-ambiente-local.md) até o passo 2.
- Os comandos rodam na raiz do repositório clonado.

## Passos

### 1. Instale as dependências e crie o `.env`

```sh
npm install
cp .env.example .env
```

O npm pode avisar de scripts de instalação não aprovados. O tutorial funciona sem aprová-los.

### 2. Suba o Postgres e o Redis

```sh
docker compose up -d --wait postgres redis
```

O comando volta quando os dois estão prontos. Você deve ver as linhas dos dois containers terminando em `Healthy`.

### 3. Crie as tabelas e os dados de exemplo

```sh
for m in identity catalog inventory orders outbox; do npm run "mig:${m}:run"; done
for m in identity catalog inventory; do npm run "seed:${m}"; done
```

Cada módulo tem as suas tabelas e as suas migrations. Os seeds criam produtos com estoque e usuários de teste ([Seeds](../reference/comandos.md#seeds)).

### 4. Suba a API

Num **segundo terminal**, na mesma pasta:

```sh
npm run start:dev
```

Espere a linha `Nest application successfully started`. Deixe esse terminal aberto: o passo 11 olha o log dele.

De volta ao primeiro terminal, confira:

```sh
curl -s localhost:3000/health/ready
```

Você deve ver `"status":"ok"`, com `database` e `redis` `up`.

### 5. Cadastre um usuário

```sh
curl -s localhost:3000/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"name":"Ana","email":"ana@example.com","password":"minha-senha-123"}'
```

Você deve ver `{"id":"..."}`, com o id do usuário novo. Se vier `EMAIL_ALREADY_IN_USE`, você já fez o tutorial neste banco: troque o e-mail aqui e no passo 6.

### 6. Entre com o usuário

Primeiro, crie uma função que tira um campo do JSON de uma resposta. Ela usa o Node que você já tem:

```sh
json() { node -p "JSON.parse(require('fs').readFileSync(0, 'utf8')).$1"; }
```

Agora o login, guardando o token:

```sh
TOKEN=$(curl -s localhost:3000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"ana@example.com","password":"minha-senha-123"}' | json accessToken)
echo $TOKEN
```

Você deve ver um token longo, em três partes separadas por ponto. Ele vale 15 minutos. Se uma chamada adiante responder 401, repita este passo.

### 7. Veja os produtos

```sh
curl -s localhost:3000/v1/products -H "Authorization: Bearer $TOKEN"
```

Você deve ver três produtos, entre eles o `Mouse sem fio`, com `"priceCents":14900`: R$ 149,00, em centavos. Guarde o id dele:

```sh
PRODUCT=22222222-2222-4222-8222-222222222222
```

### 8. Crie o pedido

```sh
ORDER=$(curl -s localhost:3000/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d "{\"items\":[{\"productId\":\"$PRODUCT\",\"qty\":2}]}" | json id)
curl -s localhost:3000/v1/orders -H "Authorization: Bearer $TOKEN"
```

Você deve ver o pedido com `"status":"DRAFT"` e `"totalCents":29800`. O pedido só levou o id do produto e a quantidade: o preço veio do catálogo, e o dono, do token.

### 9. Feche o pedido

```sh
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/v1/orders/$ORDER/place \
  -H "Authorization: Bearer $TOKEN"
curl -s localhost:3000/v1/orders/$ORDER -H "Authorization: Bearer $TOKEN"
```

Você deve ver `204` e o pedido com `"status":"PLACED"`, os itens e o total. Ao fechar, o pedido reservou duas unidades no estoque.

A consulta de um pedido lê direto do banco. A listagem do passo 8 vem de um cache, descartado pelo evento do fechamento cerca de um segundo depois. Por isso, logo depois de uma ação, consulte o pedido, e não a listagem.

### 10. Pague o pedido

```sh
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/v1/orders/$ORDER/pay \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Idempotency-Key: pagamento-1'
curl -s localhost:3000/v1/orders/$ORDER -H "Authorization: Bearer $TOKEN"
```

Você deve ver `204` e `"status":"PAID"`. O pagamento passa por um fornecedor simulado, que aprova tudo.

Rode o primeiro comando de novo, com a mesma `Idempotency-Key`. A resposta é `204` outra vez, e o pedido não é cobrado de novo: a chave diz à API que é a mesma tentativa.

### 11. Veja o e-mail de confirmação

No terminal da API, procure a linha `email sent (simulated)`, com o assunto `Pagamento confirmado: pedido <id do seu pedido>`. Ela aparece um instante depois do pagamento, uma vez só, mesmo com o pagamento repetido.

Para parar, use `Ctrl+C` no terminal da API. Para apagar o que o tutorial criou, siga [Como resetar o ambiente local](../how-to/resetar-o-ambiente-local.md).

## O que você aprendeu

- **Módulos que se conhecem por contrato:** o orders pediu o preço ao catalog e reservou o estoque no inventory só pelo contrato público de cada um, a pasta `contracts/` ([Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md) e [Agregados](../explanation/agregados.md)).
- **O dono vem do token:** o pedido pertence ao usuário autenticado, e só ele pode fechá-lo e pagá-lo ([Autenticação e ownership](../explanation/autenticacao.md)).
- **Dinheiro em centavos:** preços e totais são inteiros ([Modelagem do domínio](../explanation/modelagem-do-dominio.md)).
- **Eventos pela outbox:** o pagamento gravou o evento `orders.order-paid` junto com o pedido, e o notifications reagiu a ele depois, uma vez só ([Consistência e eventos](../explanation/consistencia-e-eventos.md#o-evento-sai-pela-outbox)).
- **Duas leituras, dois compromissos:** a listagem vem de um cache que o evento invalida e pode mostrar o estado anterior por um instante. A consulta de um pedido lê o banco e mostra a última escrita ([Redis](../explanation/redis.md#cache-da-leitura)).
- **Pagamento idempotente:** a `Idempotency-Key` torna seguro repetir a chamada ([Consistência e eventos](../explanation/consistencia-e-eventos.md#idempotency-key-no-pagamento)).
