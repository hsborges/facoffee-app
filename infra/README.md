# Infra local

docker compose com RabbitMQ, PostgreSQL (uma instância, um banco por serviço), Keycloak local (testes, mesmo protocolo OIDC do Passaporte UFMS), armazenamento de arquivos (SeaweedFS, S3) e servidor de e-mail de teste (Mailpit). Decisão em [ADR 0003](../docs/adr/0003-ambiente-local-docker-compose.md).

```sh
cd infra
cp .env.example .env
docker compose up -d --wait
```

| Serviço | Endereço |
|---|---|
| [API Gateway](../gateway/) (única porta aberta fora do host) | https://localhost |
| Documentação da API (Swagger UI, pelo gateway) | https://localhost/docs |
| RabbitMQ (AMQP / painel) | `localhost:5672` / http://localhost:15672 |
| PostgreSQL (bancos `usuario`, `participacao`, `financeiro`, `example`) | `localhost:5432` |
| Serviço de exemplo (perfil `example`) | http://localhost:3000 |
| Keycloak | http://localhost:8080 |
| SeaweedFS (S3) | http://localhost:8333 |
| Mailpit (SMTP / caixa de entrada) | `localhost:1025` / http://localhost:8025 |

Credenciais em `.env`.

## Keycloak

O realm `facoffee` é importado de [`keycloak/facoffee-realm.json`](keycloak/facoffee-realm.json) quando o Keycloak sobe (realm já existente não é sobrescrito; para reimportar, `docker compose down -v`).

- Emissor OIDC: `http://localhost:8080/realms/facoffee`
- Client do web: `facoffee-web` (público, Authorization Code + PKCE S256, redirect `http://localhost:5173/*`; também usado pelo login do Swagger UI em https://localhost/docs)
- Papéis do realm: `gestor` e `participante`
- Tela de login: tema `facoffee` em [`keycloak/themes/facoffee/`](keycloak/themes/facoffee/), segue o [Design System](../docs/SYSTEM_DESIGN.md) (estende o `keycloak.v2`; no `start-dev`, mudanças no CSS aparecem ao recarregar a página). Num ambiente que já existia, `docker compose up -d --force-recreate keycloak` reimporta o realm com o tema ([ADR 0014](../docs/adr/0014-tema-da-tela-de-login.md))

| Usuário de teste | Senha | Papéis |
|---|---|---|
| `gestor` | `gestor` | `gestor`, `participante` |
| `participante` | `participante` | `participante` |

`docker compose down -v` apaga tudo, inclusive os dados.

## Serviço de exemplo

O [template de serviço](../templates/service/) sobe no perfil `example` e publica e consome um evento pelo RabbitMQ:

```sh
docker compose --profile example up -d --wait --build
curl -X POST localhost:3000/examples -H 'content-type: application/json' -d '{"name":"Café"}'
curl localhost:3000/examples/<id>   # confirmedAt preenchido após consumir o evento
```

O banco `example` só é criado num volume novo do PostgreSQL; num volume antigo, rode `docker compose down -v` antes.
