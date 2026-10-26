# RF-PAR-04 Dever a cota do mês

- Contexto: Participação · Para quem: Participante e gestor
- Necessidade: Saber quem está pendente, sem caçar comprovante ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Termos: [Cota](../../dominio/GLOSSARIO.md#cota), [Valor da cota](../../dominio/GLOSSARIO.md#valor-da-cota)
- Origem: [Modelos §2.2](../../dominio/MODELOS.md#22-cobrança-e-pagamento), [ADR 0017](../../adr/0017-gatilhos-de-tempo-do-agendador.md)

```gherkin
# language: pt
Funcionalidade: RF-PAR-04 Dever a cota do mês
  Para a cobrança não depender do gestor,
  como gestor,
  quero que cada participante passe a dever a cota todo início de mês,
  com o valor do seu tipo de cota.
```

Quem dispara o início do mês é o agendador, a cada hora, sem duplicar cota (RNF-05). A cota devida é cobrada em Financeiro (RF-FIN-03).

## Regras

### RN-PAR-09 A cota é devida todo início de mês enquanto a pessoa participa

- Termo: [Cota](../../dominio/GLOSSARIO.md#cota) · Origem: agregado Participante (Participação)

```gherkin
# language: pt
Regra: RN-PAR-09 A cota é devida todo início de mês enquanto a pessoa participa

  Cenário: início do mês
    Dado que Ana participa com o tipo de cota completa
    Quando abril começa
    Então Ana deve a cota de abril
    E Cota devida é publicada com o valor da cota completa

  Cenário: quem saiu não deve
    Dado que Ana saiu da copa em março
    Quando abril começa
    Então Ana não deve a cota de abril
```

### RN-PAR-10 Quem entra durante o mês também deve a cota daquele mês

- Termo: [Cota](../../dominio/GLOSSARIO.md#cota) · Origem: [ADR 0017](../../adr/0017-gatilhos-de-tempo-do-agendador.md)

```gherkin
# language: pt
Regra: RN-PAR-10 Quem entra durante o mês também deve a cota daquele mês

  Cenário: entrada no meio do mês
    Dado que abril já começou
    Quando Ana pede a entrada em 15 de abril
    Então Ana deve a cota de abril
```

### RN-PAR-11 O valor da cota é o do tipo de cota do participante naquele mês, conforme o valor do ano

- Termo: [Cota](../../dominio/GLOSSARIO.md#cota) · Origem: agregado Participante (Participação)

```gherkin
# language: pt
Regra: RN-PAR-11 O valor da cota é o do tipo de cota do participante naquele mês, conforme o valor do ano

  Cenário: troca de tipo entre um mês e outro
    Dado que o valor da cota completa no ano é R$ 30,00 e o de só café é R$ 25,00
    E Ana trocou de só café para completa em março
    Quando abril começa
    Então a cota de abril de Ana é de R$ 30,00

  Cenário: tipo de cota sem valor no ano
    Dado que o tipo de cota completa não tem valor definido para o ano
    Quando abril começa
    Então Ana, do tipo completa, ainda não deve a cota de abril
    E passa a devê-la assim que o valor for definido
```

### RN-PAR-12 Depois de devida, a cota não muda

- Termo: [Cota](../../dominio/GLOSSARIO.md#cota) · Origem: [ADR 0017](../../adr/0017-gatilhos-de-tempo-do-agendador.md)

```gherkin
# language: pt
Regra: RN-PAR-12 Depois de devida, a cota não muda

  Cenário: troca de tipo depois da cota devida
    Dado que Ana deve a cota de abril de R$ 25,00
    Quando Ana troca para completa
    Então a cota de abril de Ana continua R$ 25,00

  Cenário: início do mês disparado duas vezes
    Dado que Ana já deve a cota de abril
    Quando abril começa de novo
    Então Ana continua devendo uma só cota de abril
```
