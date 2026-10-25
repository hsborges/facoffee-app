# Participação

Contexto de negócio. Quem participa, com qual tipo de cota, quanto vale cada tipo e quais cotas são devidas a cada mês.

- **Agregados:** Participante, Tipo de cota
- **Publica:** Participante entrou, Participante saiu, Cota devida, Valor da cota definido
- **Consome:** Usuário desativado

## API

Alcançada só pelo [gateway](../../gateway/), que valida o token e envia a identidade nos headers `X-User-*` ([ADR 0008](../../docs/adr/0008-dados-do-usuario-logado.md)).

| Rota pública | Resposta |
|---|---|
| `POST /api/participacao/entrar` | Com `{ tipoDeCota: "so-cafe" \| "completa" }`, o usuário logado entra e publica *Participante entrou*: 204, 400 se o tipo é inválido, ou 409 se já está participando. Retornar é entrar de novo. |
| `POST /api/participacao/trocar-tipo-de-cota` | Com `{ tipoDeCota }`, troca o tipo de cota a partir do mês seguinte, sem publicar evento (*Tipo de cota trocado* é interno): 204, 400 ou 409 se não está participando. |
| `POST /api/participacao/sair` | O usuário logado sai e publica *Participante saiu*: 204 ou 409 se não está participando. |
| `POST /api/participacao/definir-valor-da-cota` | Com `{ tipoDeCota, ano, valorEmCentavos }`, o gestor (`X-User-Roles` com `gestor`) define o valor e publica *Valor da cota definido*: 204, 400 (pedido inválido ou ano passado), 403 se não é gestor, ou 409 se já foi definido para o tipo e o ano. |

Especificação completa em [`gateway/openapi.yaml`](../../gateway/openapi.yaml).

Banco, outbox, publicação e consumidor vêm do [template de serviço](../../templates/service/). A tabela `participantes` guarda quem já entrou, o tipo de cota, a troca pendente (`troca_tipo_de_cota` a partir de `troca_a_partir_de`) e se está participando; `valores_da_cota`, o valor de cada tipo de cota por ano. Meses e anos viram à meia-noite de Campo Grande ([ADR 0015](../../docs/adr/0015-fuso-horario-do-dominio.md)).

## Eventos consumidos

Fila `participation.events`. *Usuário desativado* (`user.user-deactivated.v1`) vira *Participante saiu* se a pessoa está participando; senão, é ignorado. Pedir a saída e ter o acesso desativado publicam *Participante saiu* uma única vez.

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
curl -k -X POST https://localhost/api/participacao/entrar -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"tipoDeCota":"completa"}'
```
