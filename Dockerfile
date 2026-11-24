# Imagem de produção: o mesmo container sobe a app (`CMD`) e roda as migrations num passo separado
# (`npm run db:migrate:prod`). Como usar: docs/how-to/fazer-o-deploy.md

# Acompanha o .nvmrc: ao trocar a versão do Node, mude os dois
ARG NODE_VERSION=24

# Build: dependências completas (nest CLI, TypeScript) para compilar o src/ em dist/
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
# o npm ci vem antes do código: uma mudança no src/ não reinstala as dependências. O cache do npm fica
# fora da camada e sobrevive a uma mudança no package.json, que só baixa o que mudou
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Final: só dependências de produção e o código compilado, sem ts-node, sem src/
FROM node:${NODE_VERSION}-slim
# tini como PID 1: o Nest reenvia o sinal a si mesmo no fim do desligamento, e o kernel ignora esse
# sinal no PID 1 sem handler (docs/reference/operacao.md#desligamento)
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*
# o npm do db:migrate:prod não consulta o registry atrás de versão nova a cada `npm run`. Os exporters do
# OpenTelemetry saem desligados: sem coletor, o padrão `otlp` atrasa o desligamento em ~8 s. Com coletor,
# a plataforma os sobrescreve (docs/reference/variaveis-de-ambiente.md)
ENV NODE_ENV=production NPM_CONFIG_UPDATE_NOTIFIER=false \
  OTEL_TRACES_EXPORTER=none OTEL_METRICS_EXPORTER=none OTEL_LOGS_EXPORTER=none
WORKDIR /app
COPY package.json package-lock.json ./
# O ts-node é peer opcional do typeorm e devDependency nossa: o lockfile o marca `devOptional`, e só o
# --omit=dev o manteria, com o typescript. O --omit=optional tira os dois; das dependências de produção,
# sai só a aceleração nativa do msgpackr (msgpackr-extract), que cai para JavaScript puro.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --omit=optional
# o db:migrate:prod chama o run-scripts.mjs para rodar os mig:<módulo>:run:prod
COPY scripts/run-scripts.mjs ./scripts/
COPY --from=build /app/dist ./dist
# os arquivos ficam com dono root: o usuário node lê o código e não o altera
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
