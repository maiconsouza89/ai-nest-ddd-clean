---
type: how-to
---

# Como lançar um erro de domínio

Use este guia quando uma regra do domínio precisa recusar uma operação com uma resposta HTTP própria.

## Pré-requisitos

- O módulo tem o mapa de status em `infra/http/error-statuses.ts`, registrado nos `providers` do módulo Nest com `provideErrorStatuses(...)`. O `plop module` gera os dois ([Como criar um módulo](criar-um-modulo.md)). Se o módulo não tem o mapa, crie os dois no molde do `IDENTITY_ERROR_STATUSES` e do `identity.module.ts`.
- Um `code` para o erro, em `UPPER_SNAKE`, que nenhum outro módulo usa com outro status. Os que já existem estão na seção "Códigos de erro" de cada página de [Módulos](../README.md#módulos).

## Passos

1. Crie a classe em `domain/errors/<nome>.error.ts`, como subclasse do `DomainError`, com o `code` e a mensagem em inglês. O modelo é o `EmailAlreadyInUseError` do identity:

   ```ts
   import { DomainError } from '#shared/domain/domain-error';

   export class EmailAlreadyInUseError extends DomainError {
     readonly code = 'EMAIL_ALREADY_IN_USE';
     constructor() {
       super('Email is already in use');
     }
   }
   ```

   O cliente decide pelo `code`: não o renomeie depois de publicado. A mensagem sai no `detail` da resposta e pode mudar.

2. Lance o erro onde a regra é decidida ([Modelagem do domínio](../explanation/modelagem-do-dominio.md#a-mesma-regra-validada-em-mais-de-um-lugar)):
   - **Na entidade ou no value object**, quando a regra só depende do estado deles, como o `Email.create`, que lança o `InvalidEmailError`.
   - **No caso de uso**, quando a regra depende de outro dado, como o `RegisterUserUseCase`, que consulta o repositório:

     ```ts
     if (await this.users.findByEmail(email)) throw new EmailAlreadyInUseError();
     ```

     Se a regra é de unicidade, a checagem não basta: duas requisições simultâneas passam juntas por ela. Crie também a constraint `UNIQUE` na tabela e faça o repositório traduzir a violação (código `23505` do Postgres) no mesmo erro, como o `TypeOrmUserRepository`. Sem a tradução, a corrida responde 500.

   Não use `HttpException` no domínio nem na application: o status entra no passo seguinte.

3. Acrescente o `code` e o status ao mapa do módulo, em `infra/http/error-statuses.ts`:

   ```ts
   export const IDENTITY_ERROR_STATUSES = {
     EMAIL_ALREADY_IN_USE: 409,
     // ...
   } satisfies Record<string, number>;
   ```

   Um `code` fora do mapa responde 422 e gera um `warn` no log. Um `code` que outro módulo já registrou com outro status impede a app de subir ([Respostas de erro](../reference/respostas-de-erro.md#registro-de-status)).

4. Se o controller documenta as respostas de erro da rota, acrescente a ela um `@ApiProblemResponse(status, descrição)`, de `#shared/infra/http/problem-details.response`, como o login do `auth.controller.ts`:

   ```ts
   @ApiOkResponse({ type: SessionResponse, description: 'Sessão aberta.' })
   @ApiProblemResponse(401, 'INVALID_CREDENTIALS: e-mail ou senha errados.')
   ```

   Dois erros com o mesmo status na mesma rota dividem um decorator só, com os dois códigos na descrição. A rota precisa também do decorator da resposta de sucesso (`@ApiOkResponse`, `@ApiCreatedResponse`, `@ApiNoContentResponse`): sem ele, o `openapi:generate` falha com a lista de rotas sem resposta de sucesso. Depois, regenere o contrato com `npm run openapi:generate` e commite o `openapi.json` ([Como atualizar o contrato OpenAPI](atualizar-o-contrato-openapi.md)).

5. Acrescente o `code`, o status e a situação à seção "Códigos de erro" da página do módulo em `docs/reference/modules/<módulo>.md`, ou à página que essa seção indica. Se o erro guarda uma invariante, acrescente a regra à tabela "Invariantes" da mesma página.

6. Cubra o erro com um teste unitário, ao lado da entidade ou do caso de uso que o lança. O modelo é o `register-and-login.use-case.spec.ts`:

   ```ts
   await expect(
     register.execute({ name: 'Ana', email: ' A@X.com ', password: 'other-123' }),
   ).rejects.toThrow(EmailAlreadyInUseError);
   ```

7. Confira a resposta HTTP num teste e2e, em `test/<assunto>.e2e-spec.ts`, com o `expectProblemJson` de `test/helpers/problem.ts`. O modelo é o `auth.e2e-spec.ts`:

   ```ts
   const res = await request(server())
     .post('/v1/auth/verify-email')
     .send({ email, code: wrongCode })
     .expect(400);
   expectProblemJson(res);
   expect(res.body).toMatchObject({
     status: 400,
     code: 'INVALID_VERIFICATION_CODE',
     detail: 'Invalid verification code',
   });
   ```

## Como verificar

- `npm test -- <nome do spec>` passa.
- `npm run test:e2e -- <nome do e2e>` passa, com o Postgres, o Redis e o Mailpit do docker-compose no ar e sem o `start:dev` deste checkout rodando ([Comandos](../reference/comandos.md#testes)).
- Se o passo 4 se aplica, `npm run openapi:check` passa.

## Veja também

- [Respostas de erro](../reference/respostas-de-erro.md): o formato Problem Details, o registro de status e o que cada erro grava no log.
- [Modelagem do domínio](../explanation/modelagem-do-dominio.md#erros-são-exceptions-com-um-code): por que os erros são exceptions com um `code`.
- [Camadas](../reference/camadas.md#domain): as linhas "Erro", em Domain, e "Mapa de status", em Infra.
- [ADR 0010](../adr/0010-erros-em-problem-details-com-code.md): a resposta em Problem Details com o `code`.
