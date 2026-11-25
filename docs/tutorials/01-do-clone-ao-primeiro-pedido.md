---
type: tutorial
---

# Do clone ao primeiro pedido

Neste tutorial você sobe a API na sua máquina e faz uma compra completa pela linha de comando: cadastra um usuário, verifica o e-mail dele, entra, cria um pedido, fecha e paga.

## O que você vai construir

A API no ar com os produtos de exemplo, um usuário seu e um pedido pago. Os e-mails que a API envia (o código de verificação, as boas-vindas e a confirmação do pagamento) chegam ao Mailpit, um servidor de e-mail de desenvolvimento que os mostra no navegador sem mandar nada para fora.

O teste `test/primeiro-pedido.e2e-spec.ts` segue os mesmos passos, na mesma ordem, e confere cada resposta. As diferenças: em vez do mouse do seed, o teste cria um produto próprio, para não esgotar o estoque do seed, e lê os e-mails pela API do Mailpit, em vez do navegador.

## Pré-requisitos

- Node 22.22.3 ou superior na linha 22, 24.11.1 ou superior na linha 24, ou 25.1.0 ou superior, e Docker ([Comandos](../reference/comandos.md#requisitos)).
- `curl`, um shell bash ou zsh e um navegador.
- Nada rodando nas portas 3000, 5432, 6379, 1025 e 8025.
- Um ambiente limpo. Se você já subiu o projeto ou rodou os testes e2e, que gravam no mesmo banco, siga antes [Como resetar o ambiente local](../how-to/resetar-o-ambiente-local.md) até o passo 2.
- Os comandos rodam na raiz do repositório clonado.

## Passos

### 1. Instale as dependências e crie o `.env`

```sh
npm install
cp .env.example .env
```

O npm pode avisar de scripts de instalação não aprovados. O tutorial funciona sem aprová-los.

### 2. Suba o Postgres, o Redis e o Mailpit

```sh
docker compose up -d --wait postgres redis mailpit
```

O comando volta quando os três estão prontos. Você deve ver as linhas dos três containers terminando em `Healthy`.

Abra <http://localhost:8025> no navegador. É a caixa de entrada do Mailpit, ainda vazia. Deixe a aba aberta.

### 3. Crie as tabelas e os dados de exemplo

```sh
npm run db:setup
npm run db:seed
```

Cada módulo tem as suas tabelas e as suas migrations. Os seeds criam produtos com estoque e usuários de teste ([Seeds](../reference/comandos.md#seeds)).

### 4. Suba a API

Num **segundo terminal**, na mesma pasta:

```sh
npm run start:dev
```

Espere a linha `Nest application successfully started`. Deixe esse terminal aberto: a API roda nele.

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

Você deve ver `{"id":"..."}`, com o id do usuário novo. Se vier `EMAIL_ALREADY_IN_USE`, você já fez o tutorial neste banco: troque o e-mail aqui e nos passos 6 e 7.

A conta nasce com o e-mail por verificar, e o login fica recusado até lá. Um instante depois do cadastro, o Mailpit recebe o e-mail "Seu código de verificação", para `ana@example.com`.

### 6. Verifique o e-mail

Abra o e-mail no Mailpit e copie os 6 dígitos do código. Guarde-os no terminal, trocando `123456` pelo seu código:

```sh
CODE=123456
```

Agora confirme o código:

```sh
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/v1/auth/verify-email \
  -H 'content-type: application/json' \
  -d "{\"email\":\"ana@example.com\",\"code\":\"$CODE\"}"
```

Você deve ver `204`. No Mailpit chega o e-mail "Boas-vindas, Ana". O código vale 10 minutos e uma vez só. Se vier `400`, o código está errado ou venceu: peça outro e repita este passo com o código novo:

```sh
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/v1/auth/resend-verification-code \
  -H 'content-type: application/json' -d '{"email":"ana@example.com"}'
```

### 7. Entre com o usuário

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

### 8. Veja os produtos

```sh
curl -s localhost:3000/v1/products -H "Authorization: Bearer $TOKEN"
```

Você deve ver três produtos, entre eles o `Mouse sem fio`, com `"priceCents":14900`: R$ 149,00, em centavos. Guarde o id dele:

```sh
PRODUCT=22222222-2222-4222-8222-222222222222
```

### 9. Crie o pedido

```sh
ORDER=$(curl -s localhost:3000/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d "{\"items\":[{\"productId\":\"$PRODUCT\",\"qty\":2}]}" | json id)
curl -s localhost:3000/v1/orders -H "Authorization: Bearer $TOKEN"
```

Você deve ver o pedido com `"status":"DRAFT"` e `"totalCents":29800`. O pedido só levou o id do produto e a quantidade: o preço veio do catálogo, e o dono, do token.

### 10. Feche o pedido

```sh
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/v1/orders/$ORDER/place \
  -H "Authorization: Bearer $TOKEN"
curl -s localhost:3000/v1/orders/$ORDER -H "Authorization: Bearer $TOKEN"
```

Você deve ver `204` e o pedido com `"status":"PLACED"`, os itens e o total. Ao fechar, o pedido reservou duas unidades no estoque.

A consulta de um pedido lê direto do banco. A listagem do passo 9 vem de um cache, descartado pelo evento do fechamento cerca de um segundo depois. Por isso, logo depois de uma ação, consulte o pedido, e não a listagem.

### 11. Pague o pedido

```sh
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/v1/orders/$ORDER/pay \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Idempotency-Key: pagamento-1'
curl -s localhost:3000/v1/orders/$ORDER -H "Authorization: Bearer $TOKEN"
```

Você deve ver `204` e `"status":"PAID"`. O pagamento passa por um fornecedor simulado, que aprova tudo.

Rode o primeiro comando de novo, com a mesma `Idempotency-Key`. A resposta é `204` outra vez, e o pedido não é cobrado de novo: a chave diz à API que é a mesma tentativa.

### 12. Veja o e-mail de confirmação

No Mailpit, chega o e-mail `Pagamento confirmado: pedido <id do seu pedido>`, com o total de `BRL 298.00`. Ele aparece um instante depois do pagamento, uma vez só, mesmo com o pagamento repetido.

Para parar, use `Ctrl+C` no terminal da API. Para apagar o que o tutorial criou, siga [Como resetar o ambiente local](../how-to/resetar-o-ambiente-local.md).

## O que você aprendeu

- **Módulos que se conhecem por contrato:** o orders pediu o preço ao catalog e reservou o estoque no inventory só pelo contrato público de cada um, a pasta `contracts/` ([Comunicação entre módulos](../explanation/comunicacao-entre-modulos.md) e [Agregados](../explanation/agregados.md)).
- **Conta verificada antes do login:** o identity guardou só o hash do código, e o notifications enviou o e-mail avisado por um evento do identity ([módulo identity](../reference/modules/identity.md)).
- **O dono vem do token:** o pedido pertence ao usuário autenticado, e só ele pode fechá-lo e pagá-lo ([Autenticação e ownership](../explanation/autenticacao.md)).
- **Dinheiro em centavos:** preços e totais são inteiros ([Modelagem do domínio](../explanation/modelagem-do-dominio.md)).
- **Eventos pela outbox:** o pagamento gravou o evento `orders.order-paid` junto com o pedido, e o notifications reagiu a ele depois, uma vez só ([Consistência e eventos](../explanation/consistencia-e-eventos.md#o-evento-sai-pela-outbox)).
- **Duas leituras, dois compromissos:** a listagem vem de um cache que o evento invalida e pode mostrar o estado anterior por um instante. A consulta de um pedido lê o banco e mostra a última escrita ([Redis](../explanation/redis.md#cache-da-leitura)).
- **Pagamento idempotente:** a `Idempotency-Key` torna seguro repetir a chamada ([Consistência e eventos](../explanation/consistencia-e-eventos.md#idempotency-key-no-pagamento)).
