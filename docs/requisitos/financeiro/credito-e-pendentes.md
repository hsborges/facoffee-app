# RF-FIN-03 Crédito e pendentes

- Contexto: Financeiro · Para quem: Gestor e participantes
- Necessidades: Saber quem está pendente, sem caçar comprovante; Aceitar pagamento adiantado de semestre ou ano; Ver a própria situação (em dia, pendente, crédito) ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Termos: [Crédito](../../dominio/GLOSSARIO.md#crédito), [Pendente](../../dominio/GLOSSARIO.md#pendente), [Cota](../../dominio/GLOSSARIO.md#cota), [Complemento](../../dominio/GLOSSARIO.md#complemento)
- Origem: leitura *Crédito e pendentes* ([Modelos](../../dominio/MODELOS.md#leituras)), agregado Participante (Financeiro)

```gherkin
# language: pt
Funcionalidade: RF-FIN-03 Crédito e pendentes
  Para saber quem está em dia sem perguntar a ninguém,
  como gestor e como participante,
  quero que o FACOFFEE calcule, a partir das cotas, dos complementos e dos pagamentos,
  o crédito ou a pendência de cada um.
```

Os lembretes aos pendentes estão em RF-NOT-02.

## Regras

### RN-FIN-15 O que for pago a mais vira crédito

- Termo: [Crédito](../../dominio/GLOSSARIO.md#crédito) · Origem: glossário

O pagamento normalmente quita de uma vez as cotas de um semestre ou de um ano, no início do período; o que passa do devido fica como crédito. O dinheiro do crédito fica na caixinha, como todo pagamento (RN-FIN-30).

```gherkin
# language: pt
Regra: RN-FIN-15 O que for pago a mais vira crédito

  Cenário: pagamento adiantado
    Dado que Ana deve só a cota de março de R$ 60,00
    Quando o gestor recebe R$ 180,00 de Ana
    Então Ana tem R$ 120,00 de crédito
    E não está pendente

  Cenário: pagamento exato
    Dado que Ana deve só a cota de março de R$ 60,00
    Quando o gestor recebe R$ 60,00 de Ana
    Então Ana está em dia, sem crédito nem pendência
```

### RN-FIN-16 O crédito abate automaticamente as próximas cotas e complementos

- Termo: [Crédito](../../dominio/GLOSSARIO.md#crédito) · Origem: [Modelos §2.2](../../dominio/MODELOS.md#22-cobrança-e-pagamento)

```gherkin
# language: pt
Regra: RN-FIN-16 O crédito abate automaticamente as próximas cotas e complementos

  Cenário: cota abatida do crédito
    Dado que Ana tem R$ 120,00 de crédito
    Quando abril começa e Ana deve a cota de R$ 60,00
    Então Ana tem R$ 60,00 de crédito
    E não está pendente
    E não é avisada da cota devida
```

### RN-FIN-17 Pendente é quem tem cota ou complemento não pago nem abatido, sem multa nem juros

- Termo: [Pendente](../../dominio/GLOSSARIO.md#pendente) · Origem: glossário, [Visão, princípio 1](../../produto/VISAO.md#princípios-de-produto)

As cotas não pagas se acumulam, mês a mês. O pendente continua usando a copa e quita depois; não há multa, juros nem bloqueio.

```gherkin
# language: pt
Regra: RN-FIN-17 Pendente é quem tem cota ou complemento não pago nem abatido, sem multa nem juros

  Cenário: cotas acumuladas
    Dado que Ana deve as cotas de março e abril, de R$ 60,00 cada
    E pagou R$ 10,00
    Então Ana está pendente em exatamente R$ 110,00

  Cenário: pendente só por um complemento
    Dado que Ana está em dia com as cotas
    Quando o gestor solicita um complemento com a parte de Ana de R$ 20,00
    Então Ana está pendente em R$ 20,00
```

### RN-FIN-18 Crédito e pendência continuam valendo na saída e no retorno

- Termo: [Participante](../../dominio/GLOSSARIO.md#participante), [Pendente](../../dominio/GLOSSARIO.md#pendente) · Origem: agregado Participante (Financeiro)

Na saída, as cotas e os complementos não pagos ficam registrados como devidos, e os meses pagos adiantado ficam como crédito; nada se perde para o retorno (RN-PAR-03).

```gherkin
# language: pt
Regra: RN-FIN-18 Crédito e pendência continuam valendo na saída e no retorno

  Cenário: saída com crédito
    Dado que Ana tem R$ 30,00 de crédito
    Quando Ana sai da copa
    Então Ana continua com R$ 30,00 de crédito
    E não deve mais cota

  Cenário: saída com pendência
    Dado que Ana deve a cota de março
    Quando Ana sai e retorna em junho
    Então a cota de março de Ana continua devida
```

### RN-FIN-19 Só o gestor vê a situação de todos

- Termo: [Gestor](../../dominio/GLOSSARIO.md#gestor) · Origem: [Visão, princípio 3](../../produto/VISAO.md#princípios-de-produto) (RNF-04)

```gherkin
# language: pt
Regra: RN-FIN-19 Só o gestor vê a situação de todos

  Cenário: gestor acompanha
    Quando o gestor consulta crédito e pendentes
    Então vê a situação de cada participante, inclusive de quem saiu

  Cenário: participante tenta ver todos
    Quando Ana, participante, consulta crédito e pendentes de todos
    Então o pedido é recusado
```

### RN-FIN-20 Cada participante vê só a própria situação

- Termo: [Pendente](../../dominio/GLOSSARIO.md#pendente) · Origem: [Visão, princípio 3](../../produto/VISAO.md#princípios-de-produto) (RNF-04)

```gherkin
# language: pt
Regra: RN-FIN-20 Cada participante vê só a própria situação

  Cenário: minha situação
    Dado que Ana deve a cota de março e a parte de um complemento
    Quando Ana consulta a própria situação
    Então vê o que está pendente, com as cotas e os complementos devidos
    E não vê a situação de mais ninguém
```

### RN-FIN-21 O crédito não é devolvido em dinheiro

- Termo: [Crédito](../../dominio/GLOSSARIO.md#crédito) · Origem: glossário, [Visão, fora do escopo](../../produto/VISAO.md#fora-do-escopo)
- Verificação: revisão. Não existe devolução no FACOFFEE; o crédito fica guardado para o retorno (RN-FIN-18).

```gherkin
# language: pt
Regra: RN-FIN-21 O crédito não é devolvido em dinheiro

  Cenário: saída com crédito
    Dado que Ana tem R$ 30,00 de crédito
    Quando Ana sai da copa
    Então nenhum dinheiro é devolvido
    E o crédito fica guardado para o retorno
```

### RN-FIN-35 Antes de pagar, a pessoa vê como a situação fica depois

- Termo: [Crédito](../../dominio/GLOSSARIO.md#crédito), [Pendente](../../dominio/GLOSSARIO.md#pendente) · Origem: [protótipo](../../design/PROTOTYPE.md)

Vale no envio do comprovante (RF-FIN-02), para o participante, e no recebimento do pagamento (RF-FIN-01), para o gestor. É só uma prévia: o crédito ou a pendência continua calculado pelo Financeiro.

```gherkin
# language: pt
Regra: RN-FIN-35 Antes de pagar, a pessoa vê como a situação fica depois

  Cenário: pagamento exato
    Dado que Bia está pendente em R$ 50,00
    Quando o gestor vai receber R$ 50,00 de Bia
    Então a tela avisa que Bia fica em dia, sem crédito

  Cenário: pagamento a mais
    Dado que Ana está pendente em R$ 30,00
    Quando Ana vai enviar um comprovante de R$ 90,00
    Então a tela avisa que Ana fica com R$ 60,00 de crédito

  Cenário: pagamento a menos
    Dado que Ana está pendente em R$ 30,00
    Quando Ana vai enviar um comprovante de R$ 10,00
    Então a tela avisa que Ana continua pendente em R$ 20,00
```
