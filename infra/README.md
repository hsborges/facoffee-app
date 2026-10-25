# Infra local

docker compose com RabbitMQ, PostgreSQL (uma instância, um banco por serviço), Keycloak local (testes, mesmo protocolo OIDC do Passaporte UFMS), armazenamento de arquivos (SeaweedFS, S3) e servidor de e-mail de teste (Mailpit). Decisão em [ADR 0003](../docs/adr/0003-ambiente-local-docker-compose.md).

```sh
cd infra
cp .env.example .env
docker compose up -d --wait
```

| Serviço | Endereço |
|---|---|
| RabbitMQ (AMQP / painel) | `localhost:5672` / http://localhost:15672 |
| PostgreSQL (bancos `usuario`, `participacao`, `financeiro`) | `localhost:5432` |
| Keycloak | http://localhost:8080 |
| SeaweedFS (S3) | http://localhost:8333 |
| Mailpit (SMTP / caixa de entrada) | `localhost:1025` / http://localhost:8025 |

Credenciais em `.env`.

## Keycloak

O realm `facoffee` é importado de [`keycloak/facoffee-realm.json`](keycloak/facoffee-realm.json) quando o Keycloak sobe (realm já existente não é sobrescrito; para reimportar, `docker compose down -v`).

- Emissor OIDC: `http://localhost:8080/realms/facoffee`
- Client do web: `facoffee-web` (público, Authorization Code + PKCE S256, redirect `http://localhost:5173/*`)
- Papéis do realm: `gestor` e `participante`

| Usuário de teste | Senha | Papéis |
|---|---|---|
| `gestor` | `gestor` | `gestor`, `participante` |
| `participante` | `participante` | `participante` |

`docker compose down -v` apaga tudo, inclusive os dados.
