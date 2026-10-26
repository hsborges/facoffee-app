# RF-PAR-03 Sair da copa

- Contexto: Participação · Para quem: Participante e gestor
- Necessidade: Saber quem participa e com qual tipo de cota ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Termos: [Participante](../../dominio/GLOSSARIO.md#participante), [Gestor](../../dominio/GLOSSARIO.md#gestor)

```gherkin
# language: pt
Funcionalidade: RF-PAR-03 Sair da copa
  Para deixar de dever a cota,
  como participante,
  quero pedir a saída,
  e saio também quando o meu acesso ao FACOFFEE é desativado.
```

O que acontece com o dinheiro na saída está em RN-FIN-18: as cotas e os complementos não pagos ficam devidos, e o pago adiantado fica como crédito.

## Regras

### RN-PAR-07 Deixa de participar quem pede a saída

- Termo: [Participante](../../dominio/GLOSSARIO.md#participante) · Origem: [Modelos §2.1](../../dominio/MODELOS.md#21-participação)

```gherkin
# language: pt
Regra: RN-PAR-07 Deixa de participar quem pede a saída

  Cenário: saída
    Dado que Ana participa da copa
    Quando Ana pede a saída
    Então Ana não participa mais
    E Participante saiu é publicado

  Cenário: quem não participa não sai
    Dado que Ana não participa da copa
    Quando Ana pede a saída
    Então o pedido é recusado
```

### RN-PAR-08 O acesso desativado encerra a participação

- Termo: [Participante](../../dominio/GLOSSARIO.md#participante) · Origem: [Modelos §2.1](../../dominio/MODELOS.md#21-participação), [ADR 0011](../../adr/0011-acesso-desativado.md)

Quem desativa o acesso, e quando, está em RN-USU-01.

```gherkin
# language: pt
Regra: RN-PAR-08 O acesso desativado encerra a participação

  Cenário: acesso desativado de quem participa
    Dado que Ana participa da copa
    Quando o acesso de Ana ao FACOFFEE é desativado
    Então Ana não participa mais
    E Participante saiu é publicado

  Cenário: acesso desativado de quem já saiu
    Dado que Ana já pediu a saída
    Quando o acesso de Ana ao FACOFFEE é desativado
    Então Participante saiu não é publicado de novo
```
