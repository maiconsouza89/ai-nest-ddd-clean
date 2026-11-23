---
paths:
  - "src/**/domain/**"
  - "src/**/application/**"
  - "src/**/infra/**"
  - "src/modules/*/contracts/**"
---

# Camadas

Antes de criar ou mover um arquivo numa camada, leia a seção dela em `docs/reference/camadas.md` (Domain, Application, Infra, Contracts ou Shared). O `npm run arch` confere os imports entre camadas, e o `npm run lint`, a forma dos contratos: rode os dois e siga a mensagem de erro.
