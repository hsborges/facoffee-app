# Infra local

docker compose com RabbitMQ, PostgreSQL (uma instância, um banco por serviço), Keycloak local (testes, mesmo protocolo OIDC do Passaporte UFMS), armazenamento de arquivos (SeaweedFS, S3) e servidor de e-mail de teste (Mailpit). Decisão em [ADR 0003](../docs/adr/0003-ambiente-local-docker-compose.md).

[`docker-compose.dev.yml`](docker-compose.dev.yml) é só para desenvolvimento: as credenciais são fixas, no próprio arquivo, e o PostgreSQL aceita conexões sem senha (`POSTGRES_HOST_AUTH_METHOD=trust`), sem `.env` ([ADR 0038](../docs/adr/0038-compose-so-de-desenvolvimento.md)).

```sh
cd infra
docker compose -f docker-compose.dev.yml up -d --wait --build
```

Para refazer o contêiner a cada mudança no código, suba com `docker compose -f docker-compose.dev.yml up --watch`: mudar um arquivo de `services/<contexto>/`, `gateway/` ou `web/` refaz a imagem daquele serviço e o recria (`develop.watch`). Não é recarga a quente: cada mudança leva alguns segundos de build. Para o web, `pnpm --filter @facoffee/web dev` é mais rápido ([README do web](../web/README.md)).

| Serviço | Endereço | Credenciais |
|---|---|---|
| [API Gateway](../gateway/) (único ponto aberto fora do host) | https://localhost ou http://localhost | — |
| FACOFFEE web (pelo gateway) | https://localhost ou http://localhost | usuários de teste do [Keycloak](#keycloak) |
| Documentação da API (Swagger UI, pelo gateway) | https://localhost/docs ou http://localhost/docs | — |
| RabbitMQ (AMQP / painel) | `localhost:5672` / http://localhost:15672 | `facoffee` / `facoffee` |
| PostgreSQL (bancos `usuario`, `participacao`, `financeiro`, `notificacao`, `example`) | `localhost:5432` | sem senha; usuário com o nome do banco, ou `postgres` |
| Keycloak (console de administração) | http://localhost:8080 | `admin` / `admin` |
| SeaweedFS (S3) | http://localhost:8333 | `facoffee` / `facoffee-secret` |
| Mailpit (SMTP / caixa de entrada) | `localhost:1025` / http://localhost:8025 | — |

## Keycloak

O realm `facoffee` é importado de [`keycloak/facoffee-realm.json`](keycloak/facoffee-realm.json) quando o Keycloak sobe (realm já existente não é sobrescrito; para reimportar, `docker compose -f docker-compose.dev.yml down -v`).

- Emissor OIDC: `http://localhost:8080/realms/facoffee`
- Client do web: `facoffee-web` (público, Authorization Code + PKCE S256, redirect `http://localhost:5173/*`, `https://localhost/*` e `http://localhost/*`)
- Papéis do realm: `gestor` e `participante`
- Tela de login: tema `facoffee` em [`keycloak/themes/facoffee/`](keycloak/themes/facoffee/), segue o [Design System](../docs/design/DESIGN_SYSTEM.md) (estende o `keycloak.v2`; no `start-dev`, mudanças no CSS aparecem ao recarregar a página). Num ambiente que já existia, `docker compose -f docker-compose.dev.yml up -d --force-recreate keycloak` reimporta o realm com o tema ([ADR 0014](../docs/adr/0014-tema-da-tela-de-login.md))

| Usuário de teste | Senha | Papéis |
|---|---|---|
| `gestor` | `gestor` | `gestor`, `participante` |
| `participante` | `participante` | `participante` |

`docker compose -f docker-compose.dev.yml down -v` apaga tudo, inclusive os dados.

## Stack do teste ponta a ponta

[`docker-compose.test.yml`](docker-compose.test.yml) vai por cima do `docker-compose.dev.yml` e só muda as portas: o gateway, o Keycloak e o Mailpit em portas aleatórias de `127.0.0.1`, sem publicar o restante, para rodar ao lado desta stack. O `pnpm test:e2e` a sobe e remove sozinho, com Testcontainers ([ADR 0023](../docs/adr/0023-teste-ponta-a-ponta-com-playwright.md)).
