# 0030. Pagamento iniciado pelo participante

- Status: Aceito
- Data: 2026-10-26

## Contexto

Até aqui, só o gestor registra pagamentos: o participante manda o comprovante do PIX pelo WhatsApp, e o gestor guarda o comprovante e recebe o pagamento ([ADR 0018](0018-armazenamento-de-comprovantes-e-notas.md), *Receber pagamento por PIX ou em dinheiro*). Toda a digitação fica com o gestor, justamente a carga que ele quer reduzir ([VISAO.md](../produto/VISAO.md)). A [issue #87](https://github.com/hsborges/facoffee-app/issues/87) pede que o participante envie o próprio comprovante, com o valor pago, e que o pagamento só valha depois que o gestor confirmar, como acontece hoje quando ele confere o comprovante.

Forças em jogo:

- O princípio "só o gestor registra pagamento" continua: nenhum colega declara que pagou sem o gestor conferir.
- *Pagamento recebido* já é consumido por Notificação; mudar o contrato custaria uma versão nova.
- O comprovante enviado pode ser confirmado e recusado ao mesmo tempo, ou editado enquanto o gestor confirma.
- O arquivo continua no armazenamento do [ADR 0018](0018-armazenamento-de-comprovantes-e-notas.md), em que só o gestor guardava comprovantes.

## Decisão

**Comprovante enviado**: um agregado novo em Financeiro, tabela `comprovantes_enviados`, com o valor informado, o comprovante (o arquivo) e a situação: *a confirmar*, *confirmado* (com o valor confirmado) ou *recusado* (com o motivo). O cancelado é apagado. Enviar, editar, cancelar e recusar não geram evento.

**Confirmação**: *Confirmar comprovante* recebe o pagamento por PIX com o comprovante e o valor confirmado, na mesma transação que marca o comprovante como confirmado, e publica *Pagamento recebido* pela outbox, sem mudar o contrato. Para o resto do FACOFFEE, é um pagamento como o recebido diretamente: entra em *Crédito e pendentes* e no *Saldo da caixinha*. Antes disso, o comprovante enviado não aparece em nenhuma das duas leituras.

**Análise uma vez só**: toda mudança só acontece se o comprovante ainda está a confirmar (`where situacao = 'a-confirmar'`); a confirmação trava a linha até salvar o pagamento. Dois pedidos ao mesmo tempo: um vale, o outro recebe 409. A confirmação informa o arquivo que o gestor conferiu: se o participante o trocou depois, ela é recusada (`comprovante-alterado`, 409), e o gestor nunca confirma um arquivo que não viu. Um arquivo já usado em pagamento não é enviado nem trocado na edição, já que nunca poderia ser confirmado. Uma restrição `check` no banco garante o valor confirmado no confirmado e o motivo no recusado.

**Arquivo**: o participante passa a guardar comprovante em `POST /api/financeiro/guardar-comprovante`, só para si mesmo; o gestor continua guardando para qualquer participante. Substitui, no ADR 0018, só *quem guarda o comprovante*; o resto continua valendo.

**Rotas** ([ADR 0016](0016-nomenclatura-das-rotas-http.md)):

| Rota | Quem |
|---|---|
| `POST /api/financeiro/enviar-comprovante` | o participante, com um arquivo guardado para si |
| `POST /api/financeiro/comprovante-enviado/{id}/editar` e `/cancelar` | o participante do comprovante, enquanto a confirmar |
| `POST /api/financeiro/comprovante-enviado/{id}/confirmar` e `/recusar` | só o gestor |
| `GET /api/financeiro/comprovante-enviado` | só o gestor: os a confirmar |
| `GET /api/financeiro/comprovante-enviado/eu` | o participante: os próprios, com a situação |

O gestor continua recebendo pagamentos diretamente, em mãos ou por PIX.

## Consequências

Ganhos:

- O participante registra o próprio pagamento por PIX; o gestor só confere e confirma ou recusa.
- Notificação e as leituras de Financeiro não mudam: a confirmação é um pagamento como outro qualquer.
- Confirmar duas vezes, ou confirmar e recusar ao mesmo tempo, não gera dois pagamentos.

Custos:

- Um agregado, uma tabela e sete rotas a mais em Financeiro.
- O gestor precisa abrir o FACOFFEE para ver se há comprovante novo; o aviso fica para depois.

Riscos:

- Arquivos de comprovantes cancelados, ou trocados na edição, ficam no bucket sem limpeza, como no ADR 0018.
- O participante não recebe aviso da recusa; vê o motivo ao abrir o FACOFFEE.
