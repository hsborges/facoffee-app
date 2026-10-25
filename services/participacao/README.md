# Participação

Contexto de negócio. Quem participa, com qual tipo de cota, quanto vale cada tipo e quais cotas são devidas a cada mês.

- **Agregados:** Participante, Tipo de cota
- **Publica:** Participante entrou, Participante saiu, Cota devida, Valor da cota definido
- **Consome:** Usuário desativado

## API

Alcançada só pelo [gateway](../../gateway/), que valida o token e envia a identidade nos headers `X-User-*` ([ADR 0008](../../docs/adr/0008-dados-do-usuario-logado.md)).

| Rota pública | Resposta |
|---|---|
| `POST /api/participacao/entrada` | Com `{ tipoDeCota: "so-cafe" \| "completa" }`, o usuário logado entra e publica *Participante entrou*: 204, 400 se o tipo é inválido, ou 409 se já está participando. Retornar é entrar de novo. |

Especificação completa em [`gateway/openapi.yaml`](../../gateway/openapi.yaml).

Banco, outbox e publicação vêm do [template de serviço](../../templates/service/); ainda sem consumidor. A tabela `participantes` guarda quem já entrou, o tipo de cota e se está participando.

## Configuração

| Variável | Exemplo |
|---|---|
| `SERVICE` | `participation` (nome do contexto nos contratos) |
| `PORT` | `3000` (padrão) |
| `DATABASE_URL` | `postgres://participacao:participacao@localhost:5432/participacao` |
| `RABBITMQ_URL` | `amqp://facoffee:facoffee@localhost:5672` |

## Comandos

```sh
pnpm --filter @facoffee/participacao test               # unidade
pnpm --filter @facoffee/participacao test:integration   # precisa de postgres e rabbitmq do compose
pnpm --filter @facoffee/participacao db:generate        # gera migration após mudar src/infra/db/schema.ts
cd infra && docker compose up -d --wait --build participacao gateway
curl -k -X POST https://localhost/api/participacao/entrada -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"tipoDeCota":"completa"}'
```
