# RF-FIN-05 Solicitar complemento

- Contexto: Financeiro · Para quem: Gestor
- Necessidade: Pedir complemento quando a caixinha não dá conta ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Termos: [Complemento](../../dominio/GLOSSARIO.md#complemento), [Saldo da caixinha](../../dominio/GLOSSARIO.md#saldo-da-caixinha)
- Origem: [Modelos §2.4](../../dominio/MODELOS.md#24-complemento), agregado Complemento (Financeiro)

```gherkin
# language: pt
Funcionalidade: RF-FIN-05 Solicitar complemento
  Para repor a caixinha quando o saldo não cobre os gastos,
  como gestor,
  quero solicitar um complemento dividido entre os participantes ativos.
```

O complemento pago entra na caixinha (RN-FIN-30), é abatido do crédito (RN-FIN-16) e, enquanto não é pago, deixa o participante pendente (RN-FIN-17). Cada participante é avisado da sua parte (RN-NOT-03).

## Regras

### RN-FIN-27 Só o gestor solicita o complemento, quando o saldo da caixinha não basta

- Termo: [Gestor](../../dominio/GLOSSARIO.md#gestor), [Saldo da caixinha](../../dominio/GLOSSARIO.md#saldo-da-caixinha) · Origem: glossário

O gestor calcula quanto falta olhando o saldo (RN-FIN-30) e decide; o FACOFFEE não solicita sozinho.

```gherkin
# language: pt
Regra: RN-FIN-27 Só o gestor solicita o complemento, quando o saldo da caixinha não basta

  Cenário: participante tenta solicitar
    Quando Ana, participante, solicita um complemento de R$ 200,00
    Então o pedido é recusado
```

### RN-FIN-28 O complemento é dividido em partes iguais entre os participantes ativos no momento, inclusive os pendentes

- Termo: [Complemento](../../dominio/GLOSSARIO.md#complemento) · Origem: glossário, leitura *Participantes ativos*

Sem considerar o tipo de cota, porque costuma ser um valor pequeno. Os centavos que sobram vão um para cada parte, para nenhum se perder.

```gherkin
# language: pt
Regra: RN-FIN-28 O complemento é dividido em partes iguais entre os participantes ativos no momento, inclusive os pendentes

  Cenário: três participantes ativos
    Dado que Ana, Bia e Caio participam, e Bia está pendente
    E Dan saiu em março
    Quando o gestor solicita um complemento de R$ 10,00
    Então as partes são R$ 3,34 para Ana, R$ 3,33 para Bia e R$ 3,33 para Caio
    E Dan não deve parte
    E Complemento solicitado é publicado

  Cenário: parte menor que um centavo
    Quando o gestor solicita um complemento que não dá um centavo por participante
    Então o pedido é recusado
```

### RN-FIN-29 Quem entra depois da solicitação não deve parte; quem sai depois continua devendo a sua

- Termo: [Complemento](../../dominio/GLOSSARIO.md#complemento) · Origem: glossário

```gherkin
# language: pt
Regra: RN-FIN-29 Quem entra depois da solicitação não deve parte; quem sai depois continua devendo a sua

  Cenário: entrada depois
    Dado que o gestor solicitou um complemento em março
    Quando Eva entra na copa em abril
    Então Eva não deve parte do complemento

  Cenário: saída depois
    Dado que Ana deve a sua parte do complemento solicitado em março
    Quando Ana sai da copa em abril
    Então Ana continua devendo a sua parte
```
