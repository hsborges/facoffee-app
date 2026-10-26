# Agendador

Processo agendado na rede interna. Dispara os gatilhos de política de início do ano (valor da cota) e de início do mês (cotas devidas) no contexto Participação ([ADR 0017](../../docs/adr/0017-gatilhos-de-tempo-do-agendador.md)) e o de lembrar os pendentes em Notificação ([ADR 0027](../../docs/adr/0027-lembrete-aos-pendentes.md)).

Ao subir e depois a cada hora, chama `POST /iniciar-ano` e `POST /iniciar-mes` em Participação e `POST /lembrar-pendentes` em Notificação, nessa ordem, parando no primeiro que falhar, e registra a resposta no log (JSON, uma linha por registro). Os gatilhos são idempotentes: um disparo com falha é refeito na hora seguinte. Sem banco, sem broker e sem servidor HTTP.

## Configuração

| Variável | Exemplo |
|---|---|
| `PARTICIPACAO_URL` | `http://participacao:3000` |
| `NOTIFICACAO_URL` | `http://notificacao:3000` |

## Comandos

```sh
pnpm --filter @facoffee/agendador test
cd infra && docker compose up -d --build agendador
docker compose logs -f agendador
```
