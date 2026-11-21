# CLAUDE.md

## Pesquisa de documentação e versões (Context7)

Antes de adicionar, atualizar ou usar qualquer biblioteca, framework ou SDK, **use o Context7** (MCP `context7`: `resolve-library-id` e depois `query-docs`) para consultar a documentação atual. Não confie apenas no conhecimento de treino.

- Verifique a **versão estável mais recente** e a sintaxe/API atual antes de instalar ou escrever código que dependa dela (ex.: NestJS, TypeORM/Prisma, class-validator, Jest).
- Prefira **bibliotecas oficiais** e as recomendadas pela documentação do framework (ex.: pacotes `@nestjs/*`) em vez de alternativas de terceiros, salvo justificativa explícita.
- Ao migrar versões ou corrigir erros específicos de biblioteca, consulte o guia de migração/documentação via Context7 antes de alterar o código.
- Ao propor uma nova dependência, informe a versão consultada e por que ela é a recomendada.
- Se o Context7 não tiver a biblioteca, use a documentação oficial (web) como alternativa e deixe isso claro.
