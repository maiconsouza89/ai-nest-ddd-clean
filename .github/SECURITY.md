# Política de segurança

## Como reportar uma vulnerabilidade

Não abra issue pública. Reporte em particular pelo GitHub: aba **Security** do repositório, botão **Report a vulnerability**.

Inclua o que for possível: o que a falha permite, os passos ou o código para reproduzir, a versão do Node e o commit testado. O relato fica visível só para quem mantém o repositório até a correção ser publicada.

## Versões com correção

O template não tem releases com suporte separado. Só a `main` recebe correções.

## Escopo

O código deste repositório: a base em `src/shared/`, os módulos, os scripts, o `Dockerfile` e as workflows. Uma falha num projeto criado a partir do template vai para quem mantém esse projeto. Uma falha numa dependência vai para o projeto dela; aqui cabe o relato se o template a usa de um jeito inseguro.
