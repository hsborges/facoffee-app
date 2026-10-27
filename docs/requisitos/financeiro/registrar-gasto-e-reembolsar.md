# RF-FIN-04 Registrar gasto e reembolsar

- Contexto: Financeiro · Para quem: Gestor e participantes
- Necessidade: Registrar gastos com nota e reembolsar quem pagou ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Termos: [Gasto](../../dominio/GLOSSARIO.md#gasto), [Tipo de gasto](../../dominio/GLOSSARIO.md#tipo-de-gasto), [Compra](../../dominio/GLOSSARIO.md#compra), [Nota](../../dominio/GLOSSARIO.md#nota), [Reembolso](../../dominio/GLOSSARIO.md#reembolso)
- Origem: [Modelos §2.3](../../dominio/MODELOS.md#23-gastos), agregado Caixinha (Financeiro), #73

```gherkin
# language: pt
Funcionalidade: RF-FIN-04 Registrar gasto e reembolsar
  Para prestar contas do que saiu da caixinha,
  como gestor ou participante que pagou algo da copa,
  quero registrar o gasto com a nota e o tipo de gasto,
  e ser reembolsado pelo gestor quando paguei do próprio bolso.
```

Todo gasto e todo reembolso saem da caixinha (RN-FIN-30). Quem pagou é avisado do reembolso (RN-NOT-04).

## Regras

### RN-FIN-22 Todo gasto tem um só tipo de gasto

- Termo: [Tipo de gasto](../../dominio/GLOSSARIO.md#tipo-de-gasto) · Origem: #73

O tipo é escolhido por quem registra: café, outros itens da copa, conserto e manutenção ou reposição. Uma nota com itens de tipos diferentes fica com o tipo da maior parte do valor. O café fica separado dos outros itens porque é o que os dois tipos de cota têm em comum.

```gherkin
# language: pt
Regra: RN-FIN-22 Todo gasto tem um só tipo de gasto

  Cenário: gasto registrado com o tipo
    Quando o gestor registra um gasto de R$ 45,90 do tipo reposição, com a nota
    Então o gasto fica registrado com o tipo reposição

  Cenário: gasto sem tipo
    Quando o gestor registra um gasto sem tipo de gasto
    Então o pedido é recusado
```

### RN-FIN-23 Todo gasto tem nota, com o valor total

- Termo: [Nota](../../dominio/GLOSSARIO.md#nota) · Origem: glossário, [ADR 0018](../../adr/0018-armazenamento-de-comprovantes-e-notas.md)

Basta o valor total; o gasto não é registrado item por item. A nota é guardada por quem registra o gasto e pode ser vista por qualquer participante (transparência no agregado, RNF-09).

```gherkin
# language: pt
Regra: RN-FIN-23 Todo gasto tem nota, com o valor total

  Cenário: gasto com a própria nota
    Dado que Andrew guardou a nota de uma compra
    Quando Andrew registra o gasto de R$ 45,90 com essa nota
    Então o gasto fica registrado com a nota

  Cenário: nota de outra pessoa ou inexistente
    Dado que a nota foi guardada por Ana
    Quando Andrew registra um gasto com essa nota
    Então o pedido é recusado
```

### RN-FIN-24 Gasto pago do próprio bolso gera reembolso, e só sai da caixinha no reembolso

- Termo: [Reembolso](../../dominio/GLOSSARIO.md#reembolso), [Gasto](../../dominio/GLOSSARIO.md#gasto) · Origem: [Modelos §1](../../dominio/MODELOS.md#decisões-de-modelagem), agregado Caixinha (Financeiro)

Assim o mesmo dinheiro não sai da caixinha duas vezes. Na caixinha do mês, o gasto pago do próprio bolso conta no mês do reembolso, com o tipo do gasto reembolsado (RN-FIN-32).

```gherkin
# language: pt
Regra: RN-FIN-24 Gasto pago do próprio bolso gera reembolso, e só sai da caixinha no reembolso

  Cenário: gasto do próprio bolso
    Dado que o saldo da caixinha é R$ 500,00
    Quando Ana registra um gasto de R$ 45,90 pago do próprio bolso
    Então o saldo da caixinha continua R$ 500,00
    Quando o gestor reembolsa o gasto
    Então o saldo da caixinha é R$ 454,10
    E Reembolso feito é publicado

  Cenário: gasto pago pela caixinha
    Dado que o saldo da caixinha é R$ 500,00
    Quando o gestor registra um gasto de R$ 45,90 pago pela caixinha
    Então o saldo da caixinha é R$ 454,10
    E o gasto não pode ser reembolsado
```

### RN-FIN-25 Só o gestor reembolsa, uma vez por gasto

- Termo: [Gestor](../../dominio/GLOSSARIO.md#gestor) · Origem: glossário

```gherkin
# language: pt
Regra: RN-FIN-25 Só o gestor reembolsa, uma vez por gasto

  Cenário: segundo reembolso
    Dado que o gestor reembolsou o gasto de Ana
    Quando o gestor reembolsa o mesmo gasto de novo
    Então o pedido é recusado

  Cenário: participante tenta reembolsar
    Quando Bia, participante, reembolsa o gasto de Ana
    Então o pedido é recusado
```

### RN-FIN-26 Qualquer participante registra um gasto

- Termo: [Compra](../../dominio/GLOSSARIO.md#compra) · Origem: glossário

Normalmente quem compra é o gestor; às vezes, outro participante.

```gherkin
# language: pt
Regra: RN-FIN-26 Qualquer participante registra um gasto

  Cenário: participante compra café
    Dado que Ana, participante, guardou a nota
    Quando Ana registra o gasto de café pago do próprio bolso
    Então o gasto fica registrado em nome de Ana
```

### RN-FIN-37 Em Gastos, o gestor vê o saldo da caixinha e quanto sobra depois dos reembolsos

- Termo: [Caixinha](../../dominio/GLOSSARIO.md#caixinha), [Reembolso](../../dominio/GLOSSARIO.md#reembolso) · Origem: [protótipo do redesign](../../design/PROTOTYPE.md)

Assim o gestor decide se precisa solicitar complemento (RF-FIN-05) sem trocar de visão. Os gastos pagos do próprio bolso ainda não reembolsados ficam à parte, em *A reembolsar*.

```gherkin
# language: pt
Regra: RN-FIN-37 Em Gastos, o gestor vê o saldo da caixinha e quanto sobra depois dos reembolsos

  Cenário: gasto a reembolsar
    Dado que o saldo da caixinha é R$ 646,50
    E que Ana pagou do próprio bolso um gasto de R$ 45,90, ainda não reembolsado
    Quando o gestor abre Gastos
    Então vê o saldo da caixinha de R$ 646,50
    E R$ 600,60 depois dos reembolsos
```
