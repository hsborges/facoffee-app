# RF-FIN-02 Enviar comprovante

- Contexto: Financeiro · Para quem: Participante e gestor
- Necessidade: Enviar o comprovante do PIX sem depender do WhatsApp, e o gestor só conferir ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Termos: [Comprovante](../../dominio/GLOSSARIO.md#comprovante), [Pagamento](../../dominio/GLOSSARIO.md#pagamento), [Gestor](../../dominio/GLOSSARIO.md#gestor)
- Origem: #87, [ADR 0030](../../adr/0030-pagamento-iniciado-pelo-participante.md), agregado Comprovante enviado (Financeiro)

```gherkin
# language: pt
Funcionalidade: RF-FIN-02 Enviar comprovante
  Para registrar o meu PIX sem mandar o comprovante pelo WhatsApp,
  como participante,
  quero enviar o comprovante com o valor pago,
  e o gestor só confirma ou recusa.
```

Os avisos do comprovante enviado e recusado estão em RN-NOT-05 e RN-NOT-06. A confirmação é um pagamento como outro qualquer (RF-FIN-01).

## Regras

### RN-FIN-07 Comprovante a confirmar não é pagamento

- Termo: [Comprovante](../../dominio/GLOSSARIO.md#comprovante) · Origem: #87, [ADR 0030](../../adr/0030-pagamento-iniciado-pelo-participante.md)

```gherkin
# language: pt
Regra: RN-FIN-07 Comprovante a confirmar não é pagamento

  Cenário: comprovante enviado e ainda não analisado
    Dado que Ana deve a cota de março de R$ 60,00
    Quando Ana envia um comprovante de R$ 60,00
    Então o comprovante fica a confirmar
    E Ana continua pendente em R$ 60,00
    E o saldo da caixinha não muda
    E Comprovante enviado é publicado
```

### RN-FIN-08 O gestor confirma ou recusa o comprovante enviado, uma vez só

- Termo: [Gestor](../../dominio/GLOSSARIO.md#gestor) · Origem: [ADR 0030](../../adr/0030-pagamento-iniciado-pelo-participante.md)

```gherkin
# language: pt
Regra: RN-FIN-08 O gestor confirma ou recusa o comprovante enviado, uma vez só

  Cenário: segunda análise
    Dado que o gestor confirmou o comprovante de Ana
    Quando o gestor confirma ou recusa o mesmo comprovante de novo
    Então o pedido é recusado
    E há um só pagamento de Ana

  Cenário: um participante tenta analisar
    Dado que Ana enviou um comprovante
    Quando Bia confirma ou recusa o comprovante de Ana
    Então o pedido é recusado
```

### RN-FIN-09 Ao confirmar, o gestor recebe o pagamento e vale o valor confirmado

- Termo: [Pagamento](../../dominio/GLOSSARIO.md#pagamento) · Origem: [ADR 0030](../../adr/0030-pagamento-iniciado-pelo-participante.md)

```gherkin
# language: pt
Regra: RN-FIN-09 Ao confirmar, o gestor recebe o pagamento e vale o valor confirmado

  Cenário: gestor confirma o comprovante
    Dado que Ana enviou um comprovante de R$ 60,00
    Quando o gestor confirma o comprovante
    Então a cota de março de Ana fica quitada
    E Pagamento recebido é publicado, por PIX, com R$ 60,00

  Cenário: gestor corrige o valor
    Dado que Ana enviou um comprovante de R$ 60,00
    Quando o gestor confirma o comprovante com R$ 50,00
    Então o pagamento de Ana é de R$ 50,00
```

### RN-FIN-10 A recusa tem motivo, que o participante vê

- Termo: [Comprovante](../../dominio/GLOSSARIO.md#comprovante) · Origem: [ADR 0030](../../adr/0030-pagamento-iniciado-pelo-participante.md)

```gherkin
# language: pt
Regra: RN-FIN-10 A recusa tem motivo, que o participante vê

  Cenário: gestor recusa
    Dado que Ana enviou um comprovante de R$ 60,00
    Quando o gestor recusa o comprovante com o motivo "comprovante de outro mês"
    Então Ana vê o comprovante recusado com o motivo
    E nenhum pagamento é recebido
    E Comprovante recusado é publicado

  Cenário: recusa sem motivo
    Quando o gestor recusa o comprovante sem motivo
    Então o pedido é recusado
```

### RN-FIN-11 Enquanto a confirmar, o participante edita ou cancela o envio; depois, não

- Termo: [Comprovante](../../dominio/GLOSSARIO.md#comprovante) · Origem: [ADR 0030](../../adr/0030-pagamento-iniciado-pelo-participante.md)

O comprovante cancelado não conta como pagamento e some; editar e cancelar não geram aviso.

```gherkin
# language: pt
Regra: RN-FIN-11 Enquanto a confirmar, o participante edita ou cancela o envio; depois, não

  Cenário: editar a confirmar
    Dado que Ana enviou um comprovante de R$ 60,00
    Quando Ana edita o valor para R$ 65,00 e troca o arquivo
    Então o comprovante a confirmar é de R$ 65,00 com o novo arquivo

  Cenário: cancelar a confirmar
    Dado que Ana enviou um comprovante
    Quando Ana cancela o envio
    Então o comprovante não existe mais

  Cenário: depois da análise
    Dado que o comprovante de Ana foi confirmado ou recusado
    Quando Ana edita ou cancela o envio
    Então o pedido é recusado

  Cenário: comprovante de outra pessoa
    Dado que Ana enviou um comprovante
    Quando Bia, ou o gestor, edita ou cancela o envio de Ana
    Então o pedido é recusado
```

### RN-FIN-12 O gestor só confirma o arquivo que conferiu

- Termo: [Comprovante](../../dominio/GLOSSARIO.md#comprovante) · Origem: [ADR 0030](../../adr/0030-pagamento-iniciado-pelo-participante.md)

```gherkin
# language: pt
Regra: RN-FIN-12 O gestor só confirma o arquivo que conferiu

  Cenário: arquivo trocado depois de conferido
    Dado que o gestor abriu o comprovante de Ana
    E Ana trocou o arquivo em seguida
    Quando o gestor confirma o comprovante que abriu
    Então o pedido é recusado
    E o comprovante continua a confirmar
```

### RN-FIN-13 O participante guarda comprovante só para si; o gestor, para qualquer participante

- Termo: [Comprovante](../../dominio/GLOSSARIO.md#comprovante) · Origem: [ADR 0030](../../adr/0030-pagamento-iniciado-pelo-participante.md), [ADR 0018](../../adr/0018-armazenamento-de-comprovantes-e-notas.md)

```gherkin
# language: pt
Regra: RN-FIN-13 O participante guarda comprovante só para si; o gestor, para qualquer participante

  Cenário: participante guarda para outro
    Quando Ana guarda um comprovante para Bia
    Então o pedido é recusado

  Cenário: envio com arquivo de outra pessoa
    Dado que o comprovante guardado é de Bia
    Quando Ana envia esse comprovante
    Então o envio é recusado
```

### RN-FIN-14 O gestor vê os comprovantes a confirmar; o participante, só os próprios

- Termo: [Comprovante](../../dominio/GLOSSARIO.md#comprovante) · Origem: leitura *Comprovantes enviados* ([Modelos](../../dominio/MODELOS.md#leituras))

```gherkin
# language: pt
Regra: RN-FIN-14 O gestor vê os comprovantes a confirmar; o participante, só os próprios

  Cenário: leituras
    Dado que Ana enviou um comprovante a confirmar
    E o comprovante de Bia foi confirmado
    Então o gestor vê só o comprovante de Ana
    E Ana vê só o seu, com a situação
    E Bia vê só o seu, com o valor confirmado
```
