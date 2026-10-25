# Agendador

Processo agendado na rede interna. Chama Participação para disparar os gatilhos de política de início do ano (valor da cota) e de início do mês (cotas devidas) no contexto Participação ([ADR 0017](../../docs/adr/0017-gatilhos-de-tempo-do-agendador.md)).

Ao subir e depois a cada hora, chama `POST /iniciar-ano` e, se der certo, `POST /iniciar-mes` em Participação, e registra a resposta no log (JSON, uma linha por registro). Os dois gatilhos são idempotentes: um disparo com falha é refeito na hora seguinte. Sem banco, sem broker e sem servidor HTTP.

## Configuração

| Variável | Exemplo |
|---|---|
| `PARTICIPACAO_URL` | `http://participacao:3000` |

## Comandos

```sh
pnpm --filter @facoffee/agendador test
cd infra && docker compose up -d --build agendador
docker compose logs -f agendador
```
