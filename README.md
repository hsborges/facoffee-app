# FACOFFEE

Divisão de custos da copa da FACOM.

- [Glossário](docs/GLOSSARIO.md) — linguagem ubíqua
- [Modelos de domínio](docs/MODELOS_DOMINIO.md) — mapa conceitual, Event Storming, contextos
- [Design System](docs/SYSTEM_DESIGN.md) — identidade visual
- [Arquitetura](docs/arquitetura.png)
- [Práticas de engenharia](AGENTS.md) — fluxo, commits, versionamento, TDD, DDD, estilo

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `docs/` | Documentação e ADRs (`docs/adr/`) |
| `contracts/events/` | Contratos dos eventos de domínio (RabbitMQ) |
| `services/usuario/` | Contexto Usuário — acesso via Passaporte UFMS (Keycloak) |
| `services/participacao/` | Contexto Participação — Participante, Tipo de cota, Cota |
| `services/financeiro/` | Contexto Financeiro — Pagamento, Gasto, Caixinha, Complemento |
| `services/notificacao/` | Avisos por e-mail e WhatsApp |
| `services/agendador/` | Gatilhos de início do mês e do ano |
| `gateway/` | API Gateway |
| `web/` | FACOFFEE web |
| `infra/` | Ambiente local (docker compose, Keycloak, RabbitMQ, bancos, arquivos) |

## Stack

TypeScript / Node.js 24. Detalhes em `docs/adr/`.

## Tarefas

Backlog nas [issues](../../issues), organizado por milestones (M0–M3).
