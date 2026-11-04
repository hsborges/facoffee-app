# Participação

Contexto de negócio. Quem participa, com qual tipo de cota, quanto vale cada tipo e quais cotas são devidas a cada mês.

- **Agregados:** Participante, Tipo de cota
- **Leituras:** Valores da cota, Participantes
- **Publica:** Participante entrou, Participante saiu, Cota devida, Valor da cota definido
- **Consome:** Usuário desativado

## API

Alcançada só pelo [gateway](../../gateway/), que valida o token e envia a identidade nos headers `X-User-*` ([ADR 0008](../../docs/adr/0008-dados-do-usuario-logado.md)).

| Rota pública | Resposta |
|---|---|
| `POST /api/participacao/entrar` | Com `{ tipoDeCota: "so-cafe" \| "completa" }`, o usuário logado entra e publica *Participante entrou*: 204, 400 se o tipo é inválido, ou 409 se já está participando. Retornar é entrar de novo. |
| `POST /api/participacao/trocar-tipo-de-cota` | Com `{ tipoDeCota }`, troca o tipo de cota a partir do mês seguinte, sem publicar evento (*Tipo de cota trocado* é interno): 204, 400 ou 409 se não está participando. |
| `GET /api/participacao/participante/eu` | `{ id, tipoDeCota, participando, troca }` do usuário logado: o tipo de cota que vale no mês atual e, enquanto participa, a troca pendente (`{ tipoDeCota, aPartirDe }` ou `null`): 200, ou 404 se nunca participou. |
| `GET /api/participacao/participante` | `[{ id, tipoDeCota, participando, troca }]`, a leitura *Participantes*: quem já participou, como em `participante/eu`, só para o gestor: 200, ou 403 (RN-PAR-17). |
| `GET /api/participacao/valor-da-cota` | `[{ tipoDeCota, ano, valorEmCentavos }]`, a leitura *Valores da cota*: o valor de cada tipo de cota já definido para o ano atual, ou para o de `?ano=AAAA`, para qualquer usuário logado: 200; ano inválido: 400. |
| `POST /api/participacao/sair` | O usuário logado sai e publica *Participante saiu*: 204 ou 409 se não está participando. |
| `POST /api/participacao/definir-valor-da-cota` | Com `{ tipoDeCota, ano, valorEmCentavos }`, o gestor (`X-User-Roles` com `gestor`) define o valor e publica *Valor da cota definido*: 204, 400 se o pedido é inválido, 403 se não é gestor, ou 409 se o ano já passou ou o valor já foi definido para o tipo e o ano. |

Especificação completa em [`gateway/openapi.yaml`](../../gateway/openapi.yaml).

### Gatilhos do agendador

Rotas internas, sem identidade, chamadas pelo [agendador](../agendador/) a cada hora; o gateway não as encaminha ([ADR 0017](../../docs/adr/0017-gatilhos-de-tempo-do-agendador.md)).

| Rota interna | Resposta |
|---|---|
| `POST /iniciar-ano` | Cada tipo de cota sem valor no ano atual repete o valor do ano anterior e publica *Valor da cota definido*: 200 com `{ valoresRepetidos }`. |
| `POST /iniciar-mes` | Cada participante ativo que ainda não deve a cota do mês passa a devê-la, com o valor do seu tipo de cota naquele mês, e publica *Cota devida*: 200 com `{ cotasDevidas, semValorDaCota }`. Repetir no mesmo mês só alcança quem entrou depois; quem não tem valor para o tipo de cota fica para o próximo disparo. |

Banco, outbox, publicação e consumidor vêm do [template de serviço](../../templates/service/). A tabela `participantes` guarda quem já entrou, o tipo de cota, a troca pendente (`troca_tipo_de_cota` a partir de `troca_a_partir_de`) e se está participando; `valores_da_cota`, o valor de cada tipo de cota por ano; `cotas_devidas`, a cota de cada participante por mês, que não muda depois de devida. Meses e anos viram à meia-noite de Campo Grande ([ADR 0015](../../docs/adr/0015-fuso-horario-do-dominio.md)).

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
cd infra && docker compose -f docker-compose.dev.yml up -d --wait --build participacao gateway
curl -k -X POST https://localhost/api/participacao/entrar -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"tipoDeCota":"completa"}'
```
