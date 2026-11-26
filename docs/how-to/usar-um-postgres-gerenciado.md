---
type: how-to
---

# Como usar um Postgres gerenciado

Use este guia para apontar a app e as migrations para um Postgres gerenciado ou em outro servidor. Nada muda na imagem: o endereço, as credenciais e o SSL vêm só do `DATABASE_URL`.

## Pré-requisitos

- A imagem publicada num registry: [Como fazer o deploy](fazer-o-deploy.md).
- O banco criado no provedor, com um usuário para a app.
- As variáveis de [Variáveis de ambiente → Postgres](../reference/variaveis-de-ambiente.md#postgres), que têm padrão, incluindo como o `pg` trata cada `sslmode` e o limite de conexões por instância.

## Passos

1. Monte a URL:

   ```text
   postgres://<usuário>:<senha>@<host>:5432/<banco>?sslmode=verify-full
   ```

   Codifique na senha os caracteres reservados de URL: `@` vira `%40`, `:` vira `%3A`, `/` vira `%2F`, `#` vira `%23`.

2. Configure o SSL na própria URL:

   - com certificado de uma CA pública, `sslmode=verify-full` basta;
   - com CA própria do provedor, como no RDS, acrescente `&sslrootcert=<caminho do .pem>` e monte o arquivo no container pela plataforma, como secret ou volume. A imagem não traz certificados de CA de provedor.

3. Dê ao usuário do passo de migration a permissão `CREATE` no banco: as migrations criam o schema de cada módulo (`CREATE SCHEMA IF NOT EXISTS`).

4. Libere no firewall ou no security group do Postgres a rede da plataforma onde o container roda.

5. Ajuste o `DATABASE_POOL_MAX` para `instâncias × DATABASE_POOL_MAX` caber no `max_connections` do banco, ou no limite do plano, com folga para o passo de migration e o acesso administrativo. Com mais instâncias, baixe o `DATABASE_POOL_MAX` em vez de subir o `max_connections`.

6. Atrás de um PgBouncer em modo transaction, defina `DATABASE_STATEMENT_TIMEOUT_MS=0` e `DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS=0` no ambiente da app e ponha os limites no role do banco:

   ```sql
   ALTER ROLE <usuário> SET statement_timeout = '30s';
   ALTER ROLE <usuário> SET idle_in_transaction_session_timeout = '60s';
   ```

   Use um role à parte para o passo de migration, sem o `statement_timeout`, para uma migration longa não ser cancelada. Por que o PgBouncer pede isso: [Persistência → Pool e timeouts](../explanation/persistencia.md#pool-e-timeouts).

## Como verificar

Rode a imagem com um arquivo de env fora do repositório, como `~/deploy/ai-nest.env`, com as variáveis obrigatórias e o `DATABASE_URL` externo:

```bash
docker run --rm --env-file ~/deploy/ai-nest.env <registry>/ai-nest-ddd-clean:<tag> npm run db:migrate:prod
docker run --rm --env-file ~/deploy/ai-nest.env -p 127.0.0.1:3000:3000 <registry>/ai-nest-ddd-clean:<tag>
```

- O primeiro aplica as migrations no banco externo e termina com código 0. Se o SSL falhar, o erro aparece já nele, como `The server does not support SSL connections` ou um erro de certificado.
- Com o segundo no ar, `http://localhost:3000/health/ready` responde 200, com `database` em `up`.

## Veja também

- [Variáveis de ambiente → Postgres](../reference/variaveis-de-ambiente.md#postgres): o pool, os timeouts e o SSL.
- [Persistência → Pool e timeouts](../explanation/persistencia.md#pool-e-timeouts): por que cada limite existe.
- [Como fazer o deploy](fazer-o-deploy.md): o passo de migration e a app na plataforma.
- [Como testar a imagem de produção localmente](testar-a-imagem-de-producao-localmente.md): a imagem com o Postgres do `docker-compose.yml`.
