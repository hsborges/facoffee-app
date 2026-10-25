# Financeiro

Contexto de negócio. Pagamentos, crédito, pendências, complementos, gastos, reembolsos e caixinha.

- **Agregados:** Participante, Caixinha, Complemento
- **Leituras:** Crédito e pendentes, Saldo da caixinha, Gastos do ano anterior, Participantes ativos
- **Publica:** Pagamento recebido, Complemento solicitado, Reembolso feito
- **Consome:** Cota devida, Participante entrou, Participante saiu
- **Arquivos:** Comprovante, Nota

Banco, outbox, publicação e consumidor vêm do [template de serviço](../../templates/service/).

## Comprovantes e notas

Guardados num bucket S3 ([ADR 0018](../../docs/adr/0018-armazenamento-de-comprovantes-e-notas.md)). Upload em `multipart/form-data`, campo `arquivo`: até 5 MB, só PDF, JPEG ou PNG (pelo conteúdo, não pelo tipo declarado).

| Rota | Quem |
|---|---|
| `POST /guardar-comprovante` (com `participanteId`) → `201 { id }` | só o gestor |
| `POST /guardar-nota` → `201 { id }` | qualquer participante |
| `GET /comprovante/:id` | o participante do comprovante e o gestor; outros recebem 404 |
| `GET /nota/:id` | qualquer participante |

## Eventos consumidos

Fila `finance.events`. Cada evento é tratado uma vez só (o id vai para `processed_events`), e os tratadores também são idempotentes: um evento repetido com outro id não duplica cota nem participante.

| Evento | Efeito |
|---|---|
| *Participante entrou* (`participation.participant-joined.v1`) | O participante fica ativo; as cotas de antes continuam valendo. |
| *Participante saiu* (`participation.participant-left.v1`) | O participante deixa de ser ativo; as cotas continuam valendo. |
| *Cota devida* (`participation.contribution-due.v1`) | A cota do mês é registrada uma vez só, com o valor e o tipo de cota do evento; uma cota repetida para o mesmo mês é ignorada. |

Payload inválido é tentado de novo e vai para a fila de mensagens mortas, como no template.

A tabela `participantes` guarda quem Participação já informou e se está ativo; `cotas`, as cotas devidas por participante e mês. A leitura *Participantes ativos* (quem entrou e ainda não saiu, para dividir o complemento) é `ativos()` do repositório de participantes.

## Configuração

| Variável | Exemplo |
|---|---|
| `SERVICE` | `finance` (nome do contexto nos contratos) |
| `PORT` | `3000` (padrão) |
| `DATABASE_URL` | `postgres://financeiro:financeiro@localhost:5432/financeiro` |
| `RABBITMQ_URL` | `amqp://facoffee:facoffee@localhost:5672` |
| `S3_ENDPOINT` | `http://localhost:8333` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `facoffee` / `facoffee-secret` |
| `S3_BUCKET` | `financeiro` (criado no startup se não existir) |

## Comandos

```sh
pnpm --filter @facoffee/financeiro test               # unidade
pnpm --filter @facoffee/financeiro test:integration   # precisa de postgres, rabbitmq e seaweedfs do compose
pnpm --filter @facoffee/financeiro db:generate        # gera migration após mudar src/infra/db/schema.ts
cd infra && docker compose up -d --wait --build financeiro
```
