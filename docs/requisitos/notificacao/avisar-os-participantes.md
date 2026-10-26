# RF-NOT-01 Avisar os participantes

- Contexto: Notificação · Para quem: Todos
- Necessidade: Avisar o valor da cota do ano ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Origem: [Modelos §2.2](../../dominio/MODELOS.md#22-cobrança-e-pagamento), [ADR 0020](../../adr/0020-envio-de-e-mails-da-notificacao.md), [ADR 0031](../../adr/0031-avisos-do-comprovante-enviado.md)

```gherkin
# language: pt
Funcionalidade: RF-NOT-01 Avisar os participantes
  Para ninguém precisar perguntar ao gestor,
  como participante ou gestor,
  quero ser avisado por e-mail do que me diz respeito.
```

Cada aviso vai só a quem ele diz respeito, pelo e-mail registrado em Usuário (RN-USU-05); ninguém é exposto (RNF-04).

## Regras

### RN-NOT-01 Os participantes são avisados quando o valor da cota é definido

- Termo: [Valor da cota](../../dominio/GLOSSARIO.md#valor-da-cota) · Origem: glossário, evento *Valor da cota definido*
- Verificação: revisão. Ainda não implementado: Notificação recebe *Valor da cota definido* e não envia e-mail (o teste "Valor da cota definido ainda não avisa ninguém" registra a lacuna). Ao implementar, cite esta regra no teste e remova esta linha.

```gherkin
# language: pt
Regra: RN-NOT-01 Os participantes são avisados quando o valor da cota é definido

  Cenário: valor definido
    Quando o gestor define o valor da cota completa de 2027
    Então cada participante recebe um e-mail com o valor
```

### RN-NOT-02 Pagamento recebido avisa o participante, com o valor e a forma

- Termo: [Pagamento](../../dominio/GLOSSARIO.md#pagamento) · Origem: [ADR 0020](../../adr/0020-envio-de-e-mails-da-notificacao.md)

Vale também para a confirmação do comprovante enviado, com o valor confirmado (RN-FIN-09).

```gherkin
# language: pt
Regra: RN-NOT-02 Pagamento recebido avisa o participante, com o valor e a forma

  Cenário: pagamento por PIX
    Quando o gestor recebe R$ 60,00 de Ana por PIX
    Então Ana recebe um e-mail com R$ 60,00 e a forma PIX
```

### RN-NOT-03 Complemento solicitado avisa cada participante da sua parte

- Termo: [Complemento](../../dominio/GLOSSARIO.md#complemento) · Origem: [ADR 0020](../../adr/0020-envio-de-e-mails-da-notificacao.md)

```gherkin
# language: pt
Regra: RN-NOT-03 Complemento solicitado avisa cada participante da sua parte

  Cenário: complemento
    Quando o gestor solicita um complemento com a parte de Ana de R$ 3,34
    Então Ana recebe um e-mail com a sua parte de R$ 3,34
    E não vê a parte de mais ninguém
```

### RN-NOT-04 Reembolso feito avisa quem pagou o gasto do próprio bolso

- Termo: [Reembolso](../../dominio/GLOSSARIO.md#reembolso) · Origem: [ADR 0020](../../adr/0020-envio-de-e-mails-da-notificacao.md)

```gherkin
# language: pt
Regra: RN-NOT-04 Reembolso feito avisa quem pagou o gasto do próprio bolso

  Cenário: reembolso
    Quando o gestor reembolsa o gasto de R$ 45,90 de Ana
    Então Ana recebe um e-mail com o reembolso de R$ 45,90
```

### RN-NOT-05 Comprovante enviado avisa cada gestor, com quem enviou e o valor

- Termo: [Comprovante](../../dominio/GLOSSARIO.md#comprovante) · Origem: #88, [ADR 0031](../../adr/0031-avisos-do-comprovante-enviado.md)

Sem gestor conhecido em Usuário, não há e-mail; fica um aviso no log.

```gherkin
# language: pt
Regra: RN-NOT-05 Comprovante enviado avisa cada gestor, com quem enviou e o valor

  Cenário: comprovante enviado
    Quando Ana envia um comprovante de R$ 60,00
    Então cada gestor recebe um e-mail com o nome de Ana e R$ 60,00
```

### RN-NOT-06 Comprovante recusado avisa o participante, com o valor e o motivo

- Termo: [Comprovante](../../dominio/GLOSSARIO.md#comprovante) · Origem: #88, [ADR 0031](../../adr/0031-avisos-do-comprovante-enviado.md)

```gherkin
# language: pt
Regra: RN-NOT-06 Comprovante recusado avisa o participante, com o valor e o motivo

  Cenário: comprovante recusado
    Quando o gestor recusa o comprovante de R$ 60,00 de Ana com o motivo "comprovante de outro mês"
    Então Ana recebe um e-mail com R$ 60,00 e o motivo
```
