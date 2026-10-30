# 0036. Caixinha do ano

- Status: Aceito
- Data: 2026-10-29

## Contexto

A Caixinha mostrava o resumo de um mês por vez: o saldo no início do mês, o que entrou, o que saiu por tipo de gasto e o saldo no fim. Na revisão do [protótipo](../design/PROTOTYPE.md), a Caixinha passou a mostrar o ano inteiro, com um seletor de ano: menos detalhe mensal, e o mesmo período que embasa o valor da cota.

A leitura *Caixinha do mês* (`GET /api/financeiro/caixinha/{mes}`) só responde por um mês. Somar doze meses no web custaria doze requisições por tela, e o web não usa mais o mês.

## Decisão

- A leitura *Caixinha do ano* substitui a *Caixinha do mês*: `GET /api/financeiro/caixinha/{ano}`, com `ano` em `AAAA`. Ela devolve o saldo no início do ano, o que entrou no ano, o que saiu no ano por tipo de gasto e o saldo no fim do ano. O ano vira à meia-noite de Campo Grande ([ADR 0015](0015-fuso-horario-do-dominio.md)).
- RN-FIN-31 e RN-FIN-32 passam a falar do ano: a caixinha acumula de um ano para o outro, e a caixinha do ano mostra a todos o que entrou, o que saiu por tipo de gasto e o que sobrou.
- O gasto pago do próprio bolso conta no ano do reembolso, como antes contava no mês.
- `GET /api/financeiro/caixinha`, com o saldo e os gastos do ano anterior, não muda. O que saiu da caixinha num ano não é o mesmo que os gastos daquele ano: o gasto pago do próprio bolso sai no ano do reembolso, e os gastos do ano anterior (RN-FIN-33) contam pelo ano em que o gasto foi registrado. Por isso a Caixinha do ano atual continua mostrando os gastos do ano anterior, num expansível junto da cota, e o gestor continua a ver essa leitura em Gastos e em Valor da cota.

## Consequências

- A Caixinha faz uma requisição por ano consultado.
- É uma mudança incompatível na API pública: `GET /api/financeiro/caixinha/{mes}` deixa de existir.
- Some o detalhe mês a mês. Se ele voltar a fazer falta, entra como uma nova leitura, sem mudar a do ano.
