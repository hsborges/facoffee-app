# RF-FIN-01 Receber pagamento

- Contexto: Financeiro · Para quem: Gestor
- Necessidade: Registrar pagamento por PIX (com comprovante) ou em dinheiro ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Termos: [Pagamento](../../dominio/GLOSSARIO.md#pagamento), [Comprovante](../../dominio/GLOSSARIO.md#comprovante), [Gestor](../../dominio/GLOSSARIO.md#gestor)
- Origem: [Modelos §2.2](../../dominio/MODELOS.md#22-cobrança-e-pagamento), [ADR 0018](../../adr/0018-armazenamento-de-comprovantes-e-notas.md)

```gherkin
# language: pt
Funcionalidade: RF-FIN-01 Receber pagamento
  Para acabar com a dúvida sobre quem pagou,
  como gestor,
  quero registrar cada pagamento que recebo, por PIX com o comprovante ou em dinheiro,
  na conta do participante cujas cotas ele quita.
```

O pagamento também é recebido quando o gestor confirma o comprovante que o participante enviou (RN-FIN-09). Todo pagamento entra na caixinha (RN-FIN-30); o que for pago a mais vira crédito (RN-FIN-15). O participante é avisado do pagamento recebido (RN-NOT-02).

## Regras

### RN-FIN-01 Só o gestor recebe pagamentos

- Termo: [Gestor](../../dominio/GLOSSARIO.md#gestor) · Origem: [Visão, princípio 4](../../produto/VISAO.md#princípios-de-produto)

```gherkin
# language: pt
Regra: RN-FIN-01 Só o gestor recebe pagamentos

  Cenário: um participante tenta registrar um pagamento
    Dado que Ana não é gestora
    Quando Ana registra um pagamento de R$ 60,00 para Bia
    Então o pedido é recusado
```

### RN-FIN-02 O pagamento por PIX é acompanhado de comprovante; em dinheiro, não

- Termo: [Comprovante](../../dominio/GLOSSARIO.md#comprovante) · Origem: glossário

```gherkin
# language: pt
Regra: RN-FIN-02 O pagamento por PIX é acompanhado de comprovante; em dinheiro, não

  Cenário: PIX com comprovante
    Dado que Ana pagou R$ 60,00 por PIX
    Quando o gestor recebe o pagamento com o comprovante
    Então Pagamento recebido é publicado, por PIX

  Cenário: PIX sem comprovante
    Quando o gestor recebe um pagamento por PIX sem comprovante
    Então o pedido é recusado

  Cenário: dinheiro em mãos
    Quando o gestor recebe R$ 60,00 em dinheiro de Ana
    Então Pagamento recebido é publicado, em dinheiro, sem comprovante
```

### RN-FIN-03 O pagamento pertence ao participante cujas cotas ele quita

- Termo: [Pagamento](../../dominio/GLOSSARIO.md#pagamento) · Origem: #74, [Modelos §1](../../dominio/MODELOS.md#decisões-de-modelagem)

Quem entregou o dinheiro não é guardado e não precisa ser participante; no PIX, o nome aparece no comprovante. Cada pagamento quita as cotas de um participante só: se alguém paga por mais de uma pessoa, o gestor registra um pagamento para cada uma.

```gherkin
# language: pt
Regra: RN-FIN-03 O pagamento pertence ao participante cujas cotas ele quita

  Cenário: outra pessoa paga pelo participante
    Dado que o marido de Ana fez o PIX da cota de Ana
    Quando o gestor recebe o pagamento para Ana com o comprovante
    Então o pagamento é de Ana
    E quem fez o PIX não é guardado
```

### RN-FIN-04 O comprovante é do participante, e só ele e o gestor o veem

- Termo: [Comprovante](../../dominio/GLOSSARIO.md#comprovante) · Origem: [ADR 0018](../../adr/0018-armazenamento-de-comprovantes-e-notas.md)

```gherkin
# language: pt
Regra: RN-FIN-04 O comprovante é do participante, e só ele e o gestor o veem

  Cenário: quem vê o comprovante
    Dado que o comprovante de Ana está guardado
    Então Ana e o gestor veem o comprovante
    E para Bia o comprovante não existe
```

### RN-FIN-05 O comprovante fica guardado junto do pagamento e vale para um pagamento só

- Termo: [Comprovante](../../dominio/GLOSSARIO.md#comprovante) · Origem: glossário, [ADR 0030](../../adr/0030-pagamento-iniciado-pelo-participante.md)

```gherkin
# language: pt
Regra: RN-FIN-05 O comprovante fica guardado junto do pagamento e vale para um pagamento só

  Cenário: pagamento referencia o comprovante
    Quando o gestor recebe o pagamento por PIX de Ana com o comprovante
    Então o pagamento guarda o comprovante que o quitou

  Cenário: comprovante já usado
    Dado que o comprovante de Ana já quitou um pagamento
    Quando Ana envia o mesmo comprovante de novo
    Então o envio é recusado
```

### RN-FIN-06 Comprovante é de pagamento; o documento de um gasto é a nota

- Termo: [Comprovante](../../dominio/GLOSSARIO.md#comprovante), [Nota](../../dominio/GLOSSARIO.md#nota) · Origem: glossário

```gherkin
# language: pt
Regra: RN-FIN-06 Comprovante é de pagamento; o documento de um gasto é a nota

  Cenário: um não serve pelo outro
    Dado que a nota de um gasto está guardada
    Quando o gestor procura a nota entre os comprovantes
    Então a nota não é encontrada
```
