---
status: accepted
---

# Verificação do e-mail com o código no evento

O register cria a conta com o e-mail por verificar, e o login com a senha certa é recusado com `EMAIL_NOT_VERIFIED` até a pessoa informar um código de 6 dígitos que chega por e-mail (`POST /v1/auth/verify-email`). Verificar não abre sessão. O código vale 10 minutos (`EMAIL_VERIFICATION_CODE_TTL_SECONDS`), uma vez só, aceita até 5 tentativas erradas, e um código novo invalida o anterior. O banco do identity guarda só o hash.

Quem envia o e-mail é o notifications. O identity grava o usuário, o hash do código e o evento `identity.verification-code-issued` v1 na mesma transação, e o evento leva o código **em texto puro**, para o notifications colocá-lo no e-mail. Depois da verificação, o `identity.email-verified` v1 dispara as boas-vindas.

O preço aceito: o código fica legível na `shared.outbox` até a limpeza dos eventos publicados, 7 dias depois, e, numa linha morta, até alguém apagá-la. O mesmo payload vai para o job do BullMQ de cada consumidor, no Redis, que guarda os jobs concluídos por 24 horas e os que falharam por 7 dias (`QUEUE_JOB_OPTIONS`, no `bullmq-publisher.ts`). Quem lê a outbox ou o Redis lê os códigos. O dano é limitado: o código vence em 10 minutos, vale uma vez, e só verifica um e-mail, sem abrir sessão nem trocar senha. Para quem tem acesso de leitura ao banco, a outbox é um dos dados menos sensíveis.

Contas que existiam antes da migration ficam por verificar: o template sempre começa de um banco vazio, e os usuários dos seeds nascem verificados. Num banco antigo, uma sessão aberta antes da migration continua renovando até o prazo absoluto da família, porque só o login confere a verificação.

## Considered Options

- **Login liberado, só um aviso de conta não verificada:** mais simples para o cliente, mas qualquer um entra com uma conta aberta no e-mail de outra pessoa, e os e-mails da conta vão para o dono do endereço. Um template tem de mostrar o caminho seguro.
- **Apagar o código do payload depois da entrega:** o relay ou o consumidor reescreveria a linha da outbox sem o `code`. A outbox deixa de ser um registro do que foi publicado, a reentrega de um evento com falha perde o código, e o shared passa a conhecer um campo de um módulo.
- **O identity envia o e-mail direto:** sem código no evento, mas o envio sai da transação, um SMTP fora do ar derruba o register ou exige um retry próprio, e o identity passa a depender de SMTP e de templates de e-mail, que são do notifications.
- **Payload cifrado:** o notifications precisaria da chave do identity, o que é o mesmo acesso com um passo a mais, e a outbox ganharia uma exceção de formato.

## Consequences

- O login tem um passo a mais, e todo fluxo que cadastra e entra (o helper de auth do e2e, o tutorial e o e2e `primeiro-pedido`) verifica o e-mail no meio.
- O notifications passa a ter função própria na base, sem depender do orders.
- Encurtar a retenção da outbox, ou limpar as linhas mortas, reduz o tempo em que o código fica legível ([Evoluções com gatilho](../reference/evolucoes-com-gatilho.md#infraestrutura-e-dados)).
- O hash SHA-256 de 6 dígitos não resiste a força bruta. O que protege o código é o prazo, o limite de tentativas, contadas uma a uma por uma trava, a cota de 10 códigos por usuário em 24 horas (até 50 palpites por dia, abaixo do teto de 100 falhas do NIST SP 800-63B) e o rate limit das rotas.
- O e-mail do código não leva o nome, que chega no payload: o endereço ainda não foi verificado.
