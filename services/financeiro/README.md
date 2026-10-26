# Financeiro

Contexto de negócio. Pagamentos, comprovantes enviados, crédito, pendências, complementos, gastos, reembolsos e caixinha.

- **Agregados:** Participante, Comprovante enviado, Caixinha, Complemento
- **Leituras:** Crédito e pendentes, Saldo da caixinha, Caixinha do mês, Gastos do ano anterior, Participantes ativos, Comprovantes enviados
- **Publica:** Pagamento recebido, Complemento solicitado, Reembolso feito
- **Consome:** Cota devida, Participante entrou, Participante saiu
- **Arquivos:** Comprovante, Nota

Banco, outbox, publicação e consumidor vêm do [template de serviço](../../templates/service/).

## Comprovantes e notas

Guardados num bucket S3 ([ADR 0018](../../docs/adr/0018-armazenamento-de-comprovantes-e-notas.md)). Upload em `multipart/form-data`, campo `arquivo`: até 5 MB, só PDF, JPEG ou PNG (pelo conteúdo, não pelo tipo declarado).

| Rota | Quem |
|---|---|
| `POST /guardar-comprovante` (com `participanteId`) → `201 { id }` | o gestor, para qualquer participante; o participante, só para si ([ADR 0030](../../docs/adr/0030-pagamento-iniciado-pelo-participante.md)) |
| `POST /guardar-nota` → `201 { id }` | qualquer participante |
| `GET /comprovante/:id` | o participante do comprovante e o gestor; outros recebem 404 |
| `GET /nota/:id` | qualquer participante |

## Receber pagamento

`POST /receber-pagamento` (só o gestor), em JSON: `participanteId` (quem tem as cotas quitadas, mesmo que outra pessoa tenha pago; um pagamento por participante), `valorEmCentavos`, `forma` (`pix` ou `dinheiro`) e, no PIX, `comprovanteId` (o `id` de `/guardar-comprovante`). Responde `201 { id }` e publica *Pagamento recebido* pela outbox. Todo pagamento entra na caixinha (ver [Caixinha](#caixinha)).

| Recusa | Status |
|---|---|
| não é o gestor (`sem-permissao`) | 403 |
| PIX sem comprovante (`pix-sem-comprovante`) ou dinheiro com comprovante (`comprovante-so-no-pix`) | 400 |
| comprovante não guardado para esse participante (`comprovante-nao-encontrado`) | 404 |
| participante que Financeiro não conhece (`participante-nao-encontrado`) | 404 |
| comprovante já usado em outro pagamento (`comprovante-ja-usado`) | 409 |

## Comprovante enviado

O participante envia o próprio comprovante, que fica a confirmar até o gestor confirmar ou recusar ([ADR 0030](../../docs/adr/0030-pagamento-iniciado-pelo-participante.md)). Antes da confirmação, não conta em *Crédito e pendentes* nem no *Saldo da caixinha*. Fica na tabela `comprovantes_enviados`, com o `comprovante_id` único (um arquivo, um envio); o cancelado é apagado. Toda mudança só vale se o comprovante ainda está a confirmar, então confirmar e recusar ao mesmo tempo dá um 2xx e um 409. A confirmação informa o arquivo que o gestor conferiu e é recusada se o participante o trocou depois. Uma restrição `analise` garante o valor confirmado no confirmado e o motivo no recusado.

| Rota | Quem | Resposta |
|---|---|---|
| `POST /enviar-comprovante`, JSON `{ valorEmCentavos, comprovanteId }` (o `id` de `/guardar-comprovante`, guardado para si) | o participante | `201 { id }` |
| `POST /comprovante-enviado/:id/editar`, JSON `{ valorEmCentavos, comprovanteId }` (o mesmo ou outro arquivo guardado para si) | o participante do comprovante | `204` |
| `POST /comprovante-enviado/:id/cancelar` | o participante do comprovante | `204` |
| `POST /comprovante-enviado/:id/confirmar`, JSON `{ valorEmCentavos, comprovanteId }` (o valor confirmado, que pode corrigir o informado, e o arquivo conferido) | só o gestor | `201 { id }` do pagamento; publica *Pagamento recebido* pela outbox |
| `POST /comprovante-enviado/:id/recusar`, JSON `{ motivo }` (até 500 caracteres) | só o gestor | `204` |
| `GET /comprovante-enviado` → `200 [{ id, participanteId, comprovanteId, valorEmCentavos, enviadoEm, situacao }]`, os a confirmar, do mais antigo ao mais recente | só o gestor (os demais, 403) | |
| `GET /comprovante-enviado/eu` → `200 [...]`, os próprios, do mais recente ao mais antigo, com `valorConfirmadoEmCentavos` no confirmado e `motivo` no recusado | o participante | |

| Recusa | Status |
|---|---|
| sem valor inteiro positivo, sem `comprovanteId` ou recusa sem `motivo` (`pedido-invalido`); motivo em branco (`recusa-sem-motivo`) | 400 |
| confirmar ou recusar sem ser o gestor (`sem-permissao`) | 403 |
| arquivo não guardado para quem envia (`comprovante-nao-encontrado`); quem envia não é um participante que Financeiro conhece (`participante-nao-encontrado`) | 404 |
| comprovante que não existe ou, ao editar e cancelar, de outro participante (`comprovante-enviado-nao-encontrado`) | 404 |
| comprovante já confirmado ou recusado (`comprovante-ja-analisado`) | 409 |
| ao confirmar, arquivo trocado pelo participante depois que o gestor o conferiu (`comprovante-alterado`) | 409 |
| arquivo já enviado em outro comprovante ou já usado em outro pagamento (`comprovante-ja-usado`) | 409 |

## Registrar gasto

`POST /registrar-gasto` (qualquer participante), em JSON: `valorEmCentavos` (o valor total), `origem` (`caixinha` ou `proprio-bolso`), `tipo` (`cafe`, `outros-itens`, `conserto-e-manutencao` ou `reposicao`; sem ele, 400) e `notaId` (o `id` de `/guardar-nota`, guardada por quem registra). Quem registra é quem pagou, e é quem recebe o reembolso no gasto do próprio bolso. Responde `201 { id }`. *Gasto feito* é interno: fica só na tabela `gastos`, sem publicar nada. O gasto do próprio bolso não sai da caixinha; só o reembolso sai (`saidaDaCaixinha` em `src/domain/gasto.ts`).

| Recusa | Status |
|---|---|
| nota não guardada por quem registra (`nota-nao-encontrada`) | 404 |
| quem registra não é um participante que Financeiro conhece (`participante-nao-encontrado`) | 404 |
| nota já usada em outro gasto (`nota-ja-usada`) | 409 |

## Reembolsar

`POST /gasto/:id/reembolsar` (só o gestor), sem corpo. Devolve o valor total do gasto pago do próprio bolso a quem o registrou: responde `201 { id }` e publica *Reembolso feito* pela outbox. Fica na tabela `reembolsos`, onde o `gasto_id` único impede reembolsar o mesmo gasto duas vezes, mesmo com pedidos simultâneos. É aqui que o dinheiro do gasto do próprio bolso sai da caixinha.

| Recusa | Status |
|---|---|
| não é o gestor (`sem-permissao`) | 403 |
| gasto que não existe (`gasto-nao-encontrado`) | 404 |
| gasto pago pela caixinha (`gasto-pago-pela-caixinha`) | 409 |
| gasto já reembolsado (`gasto-ja-reembolsado`) | 409 |

## Gastos

`GET /gasto` (só o gestor; os demais, 403) → `200 [{ id, participanteId, valorEmCentavos, origem, tipo, notaId, feitoEm, reembolsado }]`, do mais recente ao mais antigo. É de onde o gestor escolhe o gasto a reembolsar; `reembolsado` é sempre `false` no gasto pago pela caixinha.

## Solicitar complemento

`POST /solicitar-complemento` (só o gestor), em JSON: `valorEmCentavos` (o valor total, que o gestor calcula). Divide em partes iguais entre os participantes ativos no momento, inclusive os pendentes e sem olhar o tipo de cota; os centavos que sobram vão um para cada, na ordem do id, e a soma das partes é sempre o valor total. Responde `201 { id }` e publica *Complemento solicitado* pela outbox. Fica nas tabelas `complementos` e `partes`; cada parte é devida como uma cota, então quem entra depois não deve e quem sai depois continua devendo.

| Recusa | Status |
|---|---|
| não é o gestor (`sem-permissao`) | 403 |
| nenhum participante ativo (`sem-participantes-ativos`) | 409 |
| valor menor que o número de participantes ativos (`parte-menor-que-um-centavo`) | 409 |

## Caixinha

`GET /caixinha` (qualquer participante) → `200 { saldoEmCentavos, gastosDoAnoAnteriorEmCentavos, gastosDoAnoAnteriorPorTipoEmCentavos: { cafe, outros-itens, conserto-e-manutencao, reposicao } }`.

- *Saldo da caixinha*: pagamentos recebidos − gastos pagos pela caixinha − reembolsos. O gasto do próprio bolso só sai no reembolso. Fica negativo quando os gastos passam do que entrou.
- *Gastos do ano anterior*: soma de todos os gastos, de qualquer origem, feitos no ano anterior pelo horário de Campo Grande ([ADR 0015](../../docs/adr/0015-fuso-horario-do-dominio.md)), no total e por tipo de gasto. Só totais: não mostra a situação de ninguém.

`GET /caixinha/:mes` (qualquer participante; `mes` em `AAAA-MM`, senão 404) → `200 { mes, saldoNoInicioEmCentavos, recebidoEmCentavos, gastosPorTipoEmCentavos: { cafe, outros-itens, conserto-e-manutencao, reposicao }, saldoNoFimEmCentavos }`, a leitura *Caixinha do mês*. O que saiu por tipo são os gastos pagos pela caixinha e os reembolsos feitos no mês, cada um pelo tipo do seu gasto; assim saldo no fim = saldo no início + recebido − gastos, e no mês atual é o saldo da caixinha. O mês vira pelo horário de Campo Grande. Só totais: não mostra a situação de ninguém.

## Crédito e pendentes

Pagamentos recebidos − cotas devidas − partes de complementos: positivo é crédito, negativo é pendente, sem multa nem juros. Como tudo entra na mesma soma, o crédito abate as próximas cotas e complementos sozinho, e crédito e pendência continuam valendo depois da saída e no retorno.

| Rota | Quem |
|---|---|
| `GET /participante` → `200 [{ id, ativo, creditoEmCentavos, pendenteEmCentavos }]` | só o gestor (os demais, 403) |
| `GET /participante/eu` → `200 { id, ativo, creditoEmCentavos, pendenteEmCentavos, cotas: [{ mes, tipoDeCota, valorEmCentavos }], complementos: [{ id, solicitadoEm, parteEmCentavos }] }`, cotas e partes da mais recente à mais antiga | o próprio participante; 404 se Financeiro não o conhece |
| `GET /pendente` → `200 [{ id, pendenteEmCentavos, cota: { mes, tipoDeCota, valorEmCentavos } \| null }]`, só os participantes ativos pendentes, com a cota mais recente | rota interna, para Notificação lembrar os pendentes; fora do gateway e 404 com `X-User-Id` ([ADR 0027](../../docs/adr/0027-lembrete-aos-pendentes.md)) |

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
