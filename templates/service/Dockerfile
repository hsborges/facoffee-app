# Build from the monorepo root: docker build -f templates/service/Dockerfile .
ARG PACKAGE=@facoffee/service-template

FROM node:24-alpine AS build
ARG PACKAGE
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "${PACKAGE}..." \
 && pnpm --filter "${PACKAGE}" build \
 && pnpm --filter "${PACKAGE}" deploy --prod /app

FROM node:24-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app .
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "dist/main.js"]
