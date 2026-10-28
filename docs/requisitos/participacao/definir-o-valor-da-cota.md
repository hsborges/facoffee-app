# RF-PAR-05 Definir o valor da cota

- Contexto: Participação · Para quem: Gestor e participantes
- Necessidades: Avisar o valor da cota do ano; Embasar o valor da cota do ano ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Termos: [Valor da cota](../../dominio/GLOSSARIO.md#valor-da-cota), [Tipo de cota](../../dominio/GLOSSARIO.md#tipo-de-cota), [Gestor](../../dominio/GLOSSARIO.md#gestor)
- Origem: [Modelos §2.5](../../dominio/MODELOS.md#25-valor-da-cota), [ADR 0017](../../adr/0017-gatilhos-de-tempo-do-agendador.md)

```gherkin
# language: pt
Funcionalidade: RF-PAR-05 Definir o valor da cota
  Para a cota de cada ano cobrir os gastos,
  como gestor,
  quero definir o valor de cada tipo de cota no início do ano,
  com base nos gastos do ano anterior,
  e todos veem o valor.
```

Os gastos do ano anterior, que embasam o valor, estão em RN-FIN-33. O aviso aos participantes está em RN-NOT-01.

## Regras

### RN-PAR-13 Só o gestor define o valor da cota

- Termo: [Gestor](../../dominio/GLOSSARIO.md#gestor) · Origem: agregado Tipo de cota (Participação)

```gherkin
# language: pt
Regra: RN-PAR-13 Só o gestor define o valor da cota

  Cenário: o gestor define
    Dado que Andrew é o gestor
    Quando Andrew define R$ 30,00 para a cota completa de 2027
    Então o valor da cota completa de 2027 é R$ 30,00
    E Valor da cota definido é publicado

  Cenário: um participante tenta definir
    Dado que Ana não é gestora
    Quando Ana define R$ 30,00 para a cota completa de 2027
    Então o pedido é recusado
```

### RN-PAR-14 O valor da cota não muda durante o ano

- Termo: [Valor da cota](../../dominio/GLOSSARIO.md#valor-da-cota) · Origem: agregado Tipo de cota (Participação)

```gherkin
# language: pt
Regra: RN-PAR-14 O valor da cota não muda durante o ano

  Cenário: segunda definição no mesmo ano
    Dado que o valor da cota completa de 2027 já é R$ 30,00
    Quando o gestor define R$ 35,00 para a cota completa de 2027
    Então o pedido é recusado
    E o valor continua R$ 30,00

  Cenário: o próximo ano pode ser definido, um ano passado não
    Dado que estamos em 2026
    Quando o gestor define o valor da cota completa de 2027
    Então o valor é aceito
    Quando o gestor define o valor da cota completa de 2025
    Então o pedido é recusado
```

### RN-PAR-15 Sem definição até o início do ano, repete-se o valor do ano anterior

- Termo: [Valor da cota](../../dominio/GLOSSARIO.md#valor-da-cota) · Origem: [ADR 0017](../../adr/0017-gatilhos-de-tempo-do-agendador.md)

```gherkin
# language: pt
Regra: RN-PAR-15 Sem definição até o início do ano, repete-se o valor do ano anterior

  Cenário: o gestor não definiu
    Dado que o valor da cota completa de 2026 é R$ 30,00
    E o gestor não definiu o valor de 2027
    Quando 2027 começa
    Então o valor da cota completa de 2027 é R$ 30,00
    E Valor da cota definido é publicado

  Cenário: o gestor já definiu
    Dado que o gestor definiu R$ 35,00 para a cota completa de 2027
    Quando 2027 começa
    Então o valor da cota completa de 2027 continua R$ 35,00
```

### RN-PAR-16 Todos veem o valor de cada tipo de cota do ano

- Termo: [Valor da cota](../../dominio/GLOSSARIO.md#valor-da-cota) · Origem: leitura *Valores da cota* ([Modelos](../../dominio/MODELOS.md#leituras))

```gherkin
# language: pt
Regra: RN-PAR-16 Todos veem o valor de cada tipo de cota do ano

  Cenário: participante consulta os valores
    Dado que os valores de 2026 são R$ 25,00 para só café e R$ 30,00 para completa
    Quando Ana, participante, consulta os valores da cota
    Então Ana vê os dois valores de 2026

  Cenário: o gestor consulta o que já definiu para o ano seguinte
    Dado que estamos em 2026
    E que o gestor definiu R$ 35,00 para a cota completa de 2027
    Quando o gestor consulta os valores da cota de 2027
    Então o gestor vê R$ 35,00 para a cota completa de 2027
```
