# FACOFFEE

Divisão de custos da copa da FACOM.

- [Documentação](docs/README.md) — produto, domínio, arquitetura, ADRs e design
- [Práticas de engenharia](AGENTS.md) — fluxo, commits, versionamento, TDD, DDD, estilo
- [Contribuindo](CONTRIBUTING.md) — ambiente, comandos, branch/PR, commits

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `docs/` | Documentação: `produto/`, `dominio/`, `arquitetura/`, `adr/`, `design/` |
| `contracts/events/` | Contratos dos eventos de domínio (RabbitMQ) |
| `services/usuario/` | Contexto Usuário — acesso via Passaporte UFMS (Keycloak) |
| `services/participacao/` | Contexto Participação — Participante, Tipo de cota, Cota |
| `services/financeiro/` | Contexto Financeiro — Pagamento, Gasto, Caixinha, Complemento |
| `services/notificacao/` | Avisos por e-mail e WhatsApp |
| `services/agendador/` | Gatilhos de início do mês e do ano |
| `templates/service/` | Template de serviço (camadas, outbox, consumidor idempotente) |
| `gateway/` | API Gateway |
| `web/` | FACOFFEE web |
| `infra/` | Ambiente local (docker compose, Keycloak, RabbitMQ, bancos, arquivos) |

## Stack

TypeScript / Node.js 24, monorepo com pnpm workspaces. Detalhes nos [ADRs](docs/adr/).

```sh
pnpm install && pnpm lint && pnpm test && pnpm build
```

## Tarefas

Backlog nas [issues](../../issues), organizado por milestones (M0–M3).
