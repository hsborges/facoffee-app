# RF-FIN-06 Acompanhar a caixinha

- Contexto: Financeiro · Para quem: Todos
- Necessidades: Resumo do mês: entrou, saiu e sobrou; Embasar o valor da cota do ano ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Termos: [Caixinha](../../dominio/GLOSSARIO.md#caixinha), [Saldo da caixinha](../../dominio/GLOSSARIO.md#saldo-da-caixinha), [Tipo de gasto](../../dominio/GLOSSARIO.md#tipo-de-gasto)
- Origem: leituras *Saldo da caixinha*, *Caixinha do mês* e *Gastos do ano anterior* ([Modelos](../../dominio/MODELOS.md#leituras)), #73, #77

```gherkin
# language: pt
Funcionalidade: RF-FIN-06 Acompanhar a caixinha
  Para saber quanto entrou, quanto saiu com cada coisa e quanto sobrou,
  como participante,
  quero ver a caixinha de cada mês e os gastos do ano anterior,
  sem ver a situação de ninguém.
```

## Regras

### RN-FIN-30 Todo pagamento entra na caixinha; todo gasto e todo reembolso saem dela

- Termo: [Caixinha](../../dominio/GLOSSARIO.md#caixinha) · Origem: glossário

O saldo da caixinha é tudo o que entrou menos tudo o que saiu: pagamentos recebidos, de cotas ou de complementos, menos gastos pagos pela caixinha e reembolsos feitos. O gasto pago do próprio bolso só sai no reembolso (RN-FIN-24).

```gherkin
# language: pt
Regra: RN-FIN-30 Todo pagamento entra na caixinha; todo gasto e todo reembolso saem dela

  Cenário: saldo
    Dado que foram recebidos R$ 500,00 em pagamentos
    E um gasto de R$ 100,00 foi pago pela caixinha
    E um reembolso de R$ 50,00 foi feito
    Então o saldo da caixinha é R$ 350,00

  Cenário: saldo negativo
    Dado que foram recebidos R$ 100,00 em pagamentos
    Quando um gasto de R$ 150,00 é pago pela caixinha
    Então o saldo da caixinha é -R$ 50,00
```

### RN-FIN-31 A caixinha acumula de um mês para o outro

- Termo: [Caixinha](../../dominio/GLOSSARIO.md#caixinha) · Origem: glossário, leitura *Caixinha do mês*

```gherkin
# language: pt
Regra: RN-FIN-31 A caixinha acumula de um mês para o outro

  Cenário: saldo no início do mês
    Dado que o saldo no fim de março é R$ 350,00
    Então o saldo no início de abril é R$ 350,00
    E o saldo no fim de abril é o do início mais o que entrou menos o que saiu em abril
```

### RN-FIN-32 A caixinha do mês mostra a todos o que entrou, o que saiu por tipo de gasto e o que sobrou, sem a situação de ninguém

- Termo: [Caixinha](../../dominio/GLOSSARIO.md#caixinha), [Tipo de gasto](../../dominio/GLOSSARIO.md#tipo-de-gasto) · Origem: #73, [Visão, princípio 5](../../produto/VISAO.md#princípios-de-produto)

```gherkin
# language: pt
Regra: RN-FIN-32 A caixinha do mês mostra a todos o que entrou, o que saiu por tipo de gasto e o que sobrou, sem a situação de ninguém

  Cenário: participante vê o resumo do mês
    Dado que em abril entraram R$ 300,00 e saíram R$ 80,00 em café e R$ 20,00 em reposição
    Quando Ana, participante, consulta a caixinha de abril
    Então vê R$ 300,00 que entraram, R$ 80,00 em café, R$ 20,00 em reposição e o saldo no início e no fim
    E não vê quem pagou nem quem está pendente
```

### RN-FIN-33 Os gastos do ano anterior, por tipo de gasto, ficam visíveis a todos

- Termo: [Gasto](../../dominio/GLOSSARIO.md#gasto) · Origem: #77, leitura *Gastos do ano anterior*

Embasam o valor da cota do ano (RF-PAR-05).

```gherkin
# language: pt
Regra: RN-FIN-33 Os gastos do ano anterior, por tipo de gasto, ficam visíveis a todos

  Cenário: participante vê os gastos do ano anterior
    Dado que em 2025 saíram R$ 1.200,00 em café e R$ 300,00 em conserto e manutenção
    Quando Ana, participante, consulta a caixinha em 2026
    Então vê o total de R$ 1.500,00 e o valor de cada tipo de gasto em 2025
```
