# RF-PAR-01 Entrar na copa

- Contexto: Participação · Para quem: Participante e gestor
- Necessidade: Saber quem participa e com qual tipo de cota ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Termos: [Participante](../../dominio/GLOSSARIO.md#participante), [Tipo de cota](../../dominio/GLOSSARIO.md#tipo-de-cota), [Gestor](../../dominio/GLOSSARIO.md#gestor)

```gherkin
# language: pt
Funcionalidade: RF-PAR-01 Entrar na copa
  Para participar da divisão dos custos da copa,
  como professor ou técnico da FACOM,
  quero pedir a entrada escolhendo um tipo de cota,
  e o gestor sabe quem participa e com qual tipo.
```

## Regras

### RN-PAR-01 Quem entra escolhe um tipo de cota

- Termo: [Participante](../../dominio/GLOSSARIO.md#participante) · Origem: [Modelos §2.1](../../dominio/MODELOS.md#21-participação)

```gherkin
# language: pt
Regra: RN-PAR-01 Quem entra escolhe um tipo de cota

  Cenário: entrada pela primeira vez
    Dado que Ana não participa da copa
    Quando Ana pede a entrada com o tipo de cota completa
    Então Ana participa com o tipo de cota completa
    E Participante entrou é publicado
```

### RN-PAR-02 Quem já participa não entra de novo

- Termo: [Participante](../../dominio/GLOSSARIO.md#participante) · Origem: RN-PAR-01

```gherkin
# language: pt
Regra: RN-PAR-02 Quem já participa não entra de novo

  Cenário: pedido repetido
    Dado que Ana participa da copa
    Quando Ana pede a entrada de novo
    Então o pedido é recusado
    E nada é publicado
```

### RN-PAR-03 Retornar é entrar de novo

- Termo: [Participante](../../dominio/GLOSSARIO.md#participante) · Origem: [Modelos §2.1](../../dominio/MODELOS.md#21-participação), [ADR 0013](../../adr/0013-reativacao-do-acesso.md)

Quem saiu pode retornar; o crédito, as cotas e os complementos não pagos ficam guardados para o retorno (RN-FIN-18). Reativar o acesso não devolve a participação (RN-USU-04).

```gherkin
# language: pt
Regra: RN-PAR-03 Retornar é entrar de novo

  Cenário: retorno com outro tipo de cota
    Dado que Ana saiu da copa em março
    Quando Ana pede a entrada em junho com o tipo de cota só café
    Então Ana participa com o tipo de cota só café
    E Participante entrou é publicado de novo
```

### RN-PAR-04 O gestor é um papel de participante

- Termo: [Gestor](../../dominio/GLOSSARIO.md#gestor) · Origem: [Modelos §1](../../dominio/MODELOS.md#decisões-de-modelagem)
- Verificação: revisão. O papel vem do perfil `gestor` do Passaporte UFMS ([ADR 0008](../../adr/0008-dados-do-usuario-logado.md)); hoje é uma pessoa só, mas nada impede mais de uma ([ADR 0031](../../adr/0031-avisos-do-comprovante-enviado.md)).

```gherkin
# language: pt
Regra: RN-PAR-04 O gestor é um papel de participante

  Cenário: o gestor também entra na copa
    Dado que Andrew é o gestor
    Quando Andrew pede a entrada com o tipo de cota completa
    Então Andrew participa como os demais
    E deve a cota todo mês como os demais
```

### RN-PAR-17 Só o gestor vê quem participa e com qual tipo de cota

- Termo: [Gestor](../../dominio/GLOSSARIO.md#gestor), [Tipo de cota](../../dominio/GLOSSARIO.md#tipo-de-cota) · Origem: leitura *Participantes* ([ADR 0035](../../adr/0035-normalizacao-da-api-publica.md))

Cada participante vê só a própria participação; a de todos é do gestor, como o crédito e a pendência (RN-FIN-19).

```gherkin
# language: pt
Regra: RN-PAR-17 Só o gestor vê quem participa e com qual tipo de cota

  Cenário: o gestor acompanha
    Dado que Ana participa com o tipo de cota completa
    Quando o gestor consulta os participantes
    Então vê Ana participando com o tipo de cota completa

  Cenário: um participante tenta ver todos
    Quando Ana, participante, consulta os participantes
    Então o pedido é recusado
```
