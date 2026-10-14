# syntax=docker/dockerfile:1.7
FROM node:22.20.0-alpine3.22 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/converter-cli/package.json apps/converter-cli/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/converter-core/package.json packages/converter-core/package.json
COPY packages/converter-schemas/package.json packages/converter-schemas/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/canvas-core/package.json packages/canvas-core/package.json
COPY packages/canvas-pixi/package.json packages/canvas-pixi/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm build
RUN pnpm deploy --filter @arcane-table/api --prod --legacy /output/api
RUN pnpm deploy --filter @arcane-table/worker --prod --legacy /output/worker

FROM nginxinc/nginx-unprivileged:1.29.2-alpine AS web
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 8080

FROM node:22.20.0-alpine3.22 AS api
ENV NODE_ENV="production"
WORKDIR /app
USER node
COPY --from=build --chown=node:node /output/api ./
EXPOSE 3000
CMD ["node", "dist/index.js"]

FROM node:22.20.0-alpine3.22 AS worker
ENV NODE_ENV="production"
WORKDIR /app
USER node
COPY --from=build --chown=node:node /output/worker ./
CMD ["node", "dist/index.js"]
