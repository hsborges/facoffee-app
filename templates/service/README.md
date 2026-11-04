# Template de serviço

Esqueleto copiável dos serviços do FACOFFEE. Decisão em [ADR 0005](../../docs/adr/0005-template-de-servico.md); stack no [ADR 0002](../../docs/adr/0002-stack.md); eventos no [ADR 0006](../../docs/adr/0006-contratos-dos-eventos-em-ingles.md). O código do template é em inglês; o código de cada serviço usa a linguagem ubíqua do [glossário](../../docs/dominio/GLOSSARIO.md).

O exemplo registra um *Example* (`POST /examples`), publica `example.example-registered.v1` pelo outbox e consome o próprio evento para confirmar o *Example*.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/domain/` | Tipos e funções puras do domínio; sem framework nem I/O |
| `src/application/` | Casos de uso e tratadores de eventos; dependem de portas (`Repository`, `Clock`) |
| `src/infra/` | Config, logs, banco (Drizzle), outbox, publicador e consumidor RabbitMQ |
| `src/api/` | Rotas HTTP (Hono) e `/health` |
| `src/service.ts` | Raiz de composição: liga as camadas |
| `drizzle/` | Migrations geradas, aplicadas no startup |

## Mensageria

- **Publicação (outbox)**: o caso de uso grava o agregado e os eventos na tabela `outbox` na mesma transação. Um relay publica os pendentes em ordem, com *publisher confirms*, e só então os marca como publicados. Se o broker cair, os eventos esperam no banco.
- **Consumo**: fila `<SERVICE>.events` (quorum, prefetch 1), ligada às routing keys de `handlers`. O id do evento é gravado em `processed_events` na mesma transação do tratador: uma entrega repetida é descartada. Falha → até 5 tentativas com espera exponencial → fila `<SERVICE>.events.dead-letter`. Envelope inválido vai direto para ela.

## Configuração

| Variável | Exemplo |
|---|---|
| `SERVICE` | `example` (nome do contexto nos contratos, ex.: `finance`; define as filas) |
| `PORT` | `3000` (padrão) |
| `DATABASE_URL` | `postgres://example:example@localhost:5432/example` |
| `RABBITMQ_URL` | `amqp://facoffee:facoffee@localhost:5672` |

## Comandos

```sh
pnpm --filter @facoffee/service-template test               # unidade
pnpm --filter @facoffee/service-template test:integration   # precisa de postgres e rabbitmq do compose
pnpm --filter @facoffee/service-template db:generate        # gera migration após mudar src/infra/db/schema.ts
docker build -f templates/service/Dockerfile .              # na raiz do monorepo
```

O template não sobe no compose ([ADR 0026](../../docs/adr/0026-dockerfile-por-servico.md)); o `Dockerfile` é o modelo que cada serviço copia. O banco `example` do teste de integração só é criado num volume novo do PostgreSQL; num volume antigo, rode `docker compose -f docker-compose.dev.yml down -v` em `infra/` antes.

## Criar um serviço

1. `cp -r templates/service services/<contexto>` (sem `node_modules` e `dist`).
2. No `package.json`, troque o nome para `@facoffee/<contexto>`; no `Dockerfile`, troque `@facoffee/service-template` pelo novo nome e `templates/service` por `services/<contexto>`.
3. Troque o exemplo pelo domínio do contexto, com a linguagem ubíqua: `domain/`, `application/`, `api/`, `infra/db/schema.ts` e os `handlers` em `service.ts`. Apague `drizzle/` e gere a migration inicial.
4. Valide os eventos publicados e consumidos contra os schemas de `contracts/events/`.
5. Adicione o serviço, o banco e o usuário em `infra/` (`docker-compose.dev.yml` apontando para `services/<contexto>/Dockerfile` e `postgres/init.sh`).
