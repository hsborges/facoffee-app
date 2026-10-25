# Build from the monorepo root: docker build -f web/Dockerfile .
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
# The root workspace brings typescript and @types/node, used by the web build.
RUN pnpm install --frozen-lockfile --filter facoffee --filter "@facoffee/web..." \
 && pnpm --filter @facoffee/web build

FROM nginx:1.29-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/web/dist /usr/share/nginx/html
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
