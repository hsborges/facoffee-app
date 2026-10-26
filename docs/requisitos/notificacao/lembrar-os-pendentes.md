# RF-NOT-02 Lembrar os pendentes

- Contexto: Notificação · Para quem: Gestor e participantes pendentes
- Necessidades: Lembrar quem está pendente sem o gestor cobrar; Avisar o início da cobrança do mês ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir))
- Termos: [Pendente](../../dominio/GLOSSARIO.md#pendente), [Cota](../../dominio/GLOSSARIO.md#cota)
- Origem: #72, [ADR 0027](../../adr/0027-lembrete-aos-pendentes.md), [Modelos §2.2](../../dominio/MODELOS.md#22-cobrança-e-pagamento)

```gherkin
# language: pt
Funcionalidade: RF-NOT-02 Lembrar os pendentes
  Para não precisar cobrar os colegas,
  como gestor,
  quero que o FACOFFEE avise a cota devida e lembre cada pendente uma vez por mês,
  em tom leve e só da própria situação.
```

Quem está pendente é a leitura *Crédito e pendentes* de Financeiro (RF-FIN-03); lembrar não muda nada no domínio. O gatilho é do agendador (RNF-05).

## Regras

### RN-NOT-07 No início do mês, quem fica com a cota pendente é avisado da cota devida; quem tem a cota abatida do crédito, não

- Termo: [Cota](../../dominio/GLOSSARIO.md#cota) · Origem: #72, [ADR 0027](../../adr/0027-lembrete-aos-pendentes.md)

```gherkin
# language: pt
Regra: RN-NOT-07 No início do mês, quem fica com a cota pendente é avisado da cota devida; quem tem a cota abatida do crédito, não

  Cenário: cota pendente
    Dado que abril começou e Ana deve a cota de abril
    E Bia tem crédito que cobre a cota de abril
    Quando o lembrete do mês roda
    Então Ana recebe o aviso da cota de abril
    E Bia não recebe nada
```

### RN-NOT-08 A partir do dia 10, cada participante ativo pendente é lembrado uma vez no mês, só da própria situação

- Termo: [Pendente](../../dominio/GLOSSARIO.md#pendente) · Origem: #72, [ADR 0027](../../adr/0027-lembrete-aos-pendentes.md)

A cota devida avisada do dia 10 em diante já conta como o lembrete do mês: um e-mail só. Quem está pendente só por um complemento também é lembrado.

```gherkin
# language: pt
Regra: RN-NOT-08 A partir do dia 10, cada participante ativo pendente é lembrado uma vez no mês, só da própria situação

  Cenário: lembrete do mês
    Dado que é dia 10 de abril e Ana está pendente
    Quando o lembrete do mês roda
    Então Ana recebe um lembrete só com a própria pendência
    Quando o lembrete do mês roda de novo em abril
    Então Ana não recebe outro lembrete

  Cenário: antes do dia 10
    Dado que é dia 5 de abril e Ana está pendente desde março
    Quando o lembrete do mês roda
    Então Ana não recebe lembrete
```

### RN-NOT-09 Quem saiu com pendência não é lembrado; continua com o gestor

- Termo: [Pendente](../../dominio/GLOSSARIO.md#pendente) · Origem: [ADR 0027](../../adr/0027-lembrete-aos-pendentes.md)

```gherkin
# language: pt
Regra: RN-NOT-09 Quem saiu com pendência não é lembrado; continua com o gestor

  Cenário: pendente que saiu
    Dado que Ana saiu da copa devendo a cota de março
    Quando o lembrete do mês roda
    Então Ana não recebe lembrete
    E o gestor continua vendo a pendência de Ana
```

### RN-NOT-10 Nenhum aviso de cobrança sai antes das 8h de Campo Grande

- Origem: [ADR 0027](../../adr/0027-lembrete-aos-pendentes.md), [ADR 0015](../../adr/0015-fuso-horario-do-dominio.md)

```gherkin
# language: pt
Regra: RN-NOT-10 Nenhum aviso de cobrança sai antes das 8h de Campo Grande

  Cenário: madrugada
    Dado que são 3h em Campo Grande e Ana está pendente
    Quando o lembrete do mês roda
    Então nada é enviado
    E o lembrete espera o próximo disparo depois das 8h
```
