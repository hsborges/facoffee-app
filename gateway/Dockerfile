# Build from the monorepo root: docker build -f gateway/Dockerfile .
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store
COPY tsconfig.base.json ./
COPY gateway/package.json gateway/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prefer-offline --frozen-lockfile --store-dir /pnpm/store --filter "@facoffee/gateway..."
COPY gateway gateway
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @facoffee/gateway build \
 && pnpm --filter @facoffee/gateway deploy --prod --store-dir /pnpm/store /app

FROM node:24-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app .
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "dist/main.js"]
