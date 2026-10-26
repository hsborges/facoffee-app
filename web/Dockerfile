# Build from the monorepo root: docker build -f web/Dockerfile .
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store
COPY tsconfig.base.json ./
COPY web/package.json web/
# The root workspace brings typescript and @types/node, used by the web build.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prefer-offline --frozen-lockfile --store-dir /pnpm/store --filter facoffee --filter "@facoffee/web..."
# Logo and fonts are shared with the Keycloak login theme.
COPY infra/keycloak/themes/facoffee/login/resources infra/keycloak/themes/facoffee/login/resources
COPY web web
RUN pnpm --filter @facoffee/web build

FROM nginx:1.29-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/web/dist /usr/share/nginx/html
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
