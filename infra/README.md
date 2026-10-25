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

Credenciais em `.env`. O realm do FACOFFEE fica para a issue #6.

`docker compose down -v` apaga tudo, inclusive os dados.
