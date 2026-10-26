# Build from the monorepo root: docker build -f services/agendador/Dockerfile .
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store
COPY tsconfig.base.json ./
COPY services/agendador/package.json services/agendador/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prefer-offline --frozen-lockfile --store-dir /pnpm/store --filter "@facoffee/agendador..."
COPY services/agendador services/agendador
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @facoffee/agendador build \
 && pnpm --filter @facoffee/agendador deploy --prod --store-dir /pnpm/store /app

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app .
USER node
CMD ["node", "dist/main.js"]
