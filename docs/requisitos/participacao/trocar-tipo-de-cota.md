# RF-PAR-02 Trocar tipo de cota

- Contexto: Participação · Para quem: Participante
- Necessidade: Saber quem participa e com qual tipo de cota ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Termos: [Tipo de cota](../../dominio/GLOSSARIO.md#tipo-de-cota), [Cota](../../dominio/GLOSSARIO.md#cota)

```gherkin
# language: pt
Funcionalidade: RF-PAR-02 Trocar tipo de cota
  Para mudar o que consumo na copa,
  como participante,
  quero trocar entre só café e completa.
```

## Regras

### RN-PAR-05 A troca de tipo só vale a partir do mês seguinte

- Termo: [Tipo de cota](../../dominio/GLOSSARIO.md#tipo-de-cota) · Origem: agregado Participante (Participação), [ADR 0015](../../adr/0015-fuso-horario-do-dominio.md)

```gherkin
# language: pt
Regra: RN-PAR-05 A troca de tipo só vale a partir do mês seguinte

  Cenário: a cota do mês mantém o tipo
    Dado que Ana participa com o tipo de cota só café
    Quando Ana troca para completa em 15 de março
    Então a cota de março de Ana é de só café
    E a cota de abril de Ana é de completa

  Cenário: pedir o tipo atual cancela a troca que espera
    Dado que Ana pediu em março a troca de só café para completa
    Quando Ana pede só café ainda em março
    Então a cota de abril de Ana é de só café
```

### RN-PAR-06 Só quem participa troca de tipo

- Termo: [Participante](../../dominio/GLOSSARIO.md#participante) · Origem: RN-PAR-05

```gherkin
# language: pt
Regra: RN-PAR-06 Só quem participa troca de tipo

  Cenário: quem saiu não troca
    Dado que Ana saiu da copa
    Quando Ana pede a troca para completa
    Então o pedido é recusado
```
