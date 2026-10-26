# Build from the monorepo root: docker build -f services/usuario/Dockerfile .
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store
COPY tsconfig.base.json ./
COPY services/usuario/package.json services/usuario/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prefer-offline --frozen-lockfile --store-dir /pnpm/store --filter "@facoffee/usuario..."
COPY services/usuario services/usuario
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @facoffee/usuario build \
 && pnpm --filter @facoffee/usuario deploy --prod --store-dir /pnpm/store /app

FROM node:24-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app .
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "dist/main.js"]
