# Glossário da Linguagem Ubíqua: FACOFFEE

| | |
|---|---|
| **Escopo** | Divisão de custos da copa da FACOM |
| **Sistema** | FACOFFEE |
| **Disciplina** | Técnicas Avançadas de Desenvolvimento de Software (2026/2) |
| **Versão** | 2.1 |
| **Data** | 2026-10-24 |
| **Status** | Aprovado |

## Propósito

Este glossário define a linguagem ubíqua usada na divisão de custos da copa da FACOM, o domínio do sistema **FACOFFEE**. Os termos daqui devem ser usados, com o mesmo sentido, nas conversas com o especialista, nos modelos de domínio e no código.

## Fontes e método

- Entrevistas com o gestor da copa (proto-persona).
- Glossários entregues na atividade *System Design com Domain-Driven Design (DDD)*: 23 glossários distintos, entre individuais e de duplas.
- Entraram os termos que aparecem em pelo menos 6 dos 23 glossários. As definições foram conferidas com os fatos do domínio.
- Os termos [Crédito](#crédito) e [Complemento](#complemento) foram definidos para responder às questões levantadas durante a consolidação.
- A versão 2.0 incorpora as decisões tomadas no desenho da arquitetura do FACOFFEE ([arquitetura.png](arquitetura.png)): a divisão em contextos, a saída por desativação do acesso e a divisão do complemento entre todos os participantes ativos.

## Convenções

- Os termos aparecem em ordem alfabética.
- **Definição**: o significado do termo dentro do escopo deste glossário.
- **Regras**: fatos do domínio ligados ao termo.
- **O gestor também diz**: palavras que o especialista usa com o mesmo sentido. Valem na conversa, mas nos modelos e no código usa-se só o termo do glossário.
- **Relacionados**: outros termos do glossário ligados a este.

## Visão por área

A coluna **Contexto** indica em qual contexto do FACOFFEE o termo é tratado. Os contextos estão descritos nos [Modelos de Domínio](MODELOS_DOMINIO.md#3-contextos-delimitados).

| Área | Termos | Contexto |
|---|---|---|
| Participação | [Participante](#participante), [Gestor](#gestor) | Participação |
| Cotas | [Cota](#cota), [Tipo de cota](#tipo-de-cota), [Valor da cota](#valor-da-cota) | Participação |
| Pagamento | [Pagamento](#pagamento), [Comprovante](#comprovante), [Crédito](#crédito), [Pendente](#pendente) | Financeiro |
| Gastos | [Gasto](#gasto), [Compra](#compra), [Nota](#nota), [Reembolso](#reembolso) | Financeiro |
| Caixinha | [Caixinha](#caixinha), [Saldo da caixinha](#saldo-da-caixinha), [Complemento](#complemento) | Financeiro |
| Uso da copa | [Copa](#copa), [Consumo](#consumo) | Fora do sistema: o uso da copa não é registrado. |

Dois termos aparecem em mais de um contexto:

- **[Participante](#participante)**: em Participação, importa se a pessoa participa e com qual tipo de cota; em Financeiro, importa o que ela deve, pagou e tem de crédito.
- **[Cota](#cota)**: nasce em Participação, todo mês, e é cobrada em Financeiro.

## Termos

### Caixinha

**Definição:** O dinheiro da divisão dos custos. Tudo o que os participantes pagam entra na caixinha, e todo gasto sai dela.

**Regras:**
- Recebe todos os pagamentos, sejam de cotas ou de complementos.
- Paga todos os gastos e reembolsos.
- Acumula de um mês para o outro.

**O gestor também diz:** "reserva", "fundo".

**Relacionados:** [Saldo da caixinha](#saldo-da-caixinha), [Pagamento](#pagamento), [Gasto](#gasto), [Complemento](#complemento).

### Complemento

**Definição:** O valor extra que o gestor pede aos participantes quando o saldo da caixinha não é suficiente para os gastos.

**Regras:**
- O gestor calcula quanto falta e solicita o complemento aos participantes.
- É dividido em partes iguais entre todos os participantes ativos no momento da solicitação, inclusive os pendentes, sem considerar o tipo de cota, porque costuma ser um valor pequeno.
- Quem entra depois da solicitação não deve parte do complemento; quem sai depois continua devendo a sua parte.
- O complemento pago entra na caixinha.
- Pode ser abatido do [crédito](#crédito) do participante.
- Enquanto não paga o complemento, o participante fica [pendente](#pendente).

**Relacionados:** [Saldo da caixinha](#saldo-da-caixinha), [Caixinha](#caixinha), [Gestor](#gestor), [Pagamento](#pagamento), [Crédito](#crédito), [Pendente](#pendente).

### Compra

**Definição:** A aquisição de itens para abastecer a copa, feita conforme eles vão acabando.

**Regras:**
- Normalmente quem compra é o gestor; às vezes, outro participante.

**O gestor também diz:** "reposição".

**Relacionados:** [Gasto](#gasto), [Nota](#nota), [Reembolso](#reembolso).

### Comprovante

**Definição:** A prova de um pagamento por PIX, que o participante envia ao gestor.

**Regras:**
- Só se aplica a pagamentos. O documento de um gasto é a [Nota](#nota).
- Fica guardado junto do pagamento a que se refere.

**Relacionados:** [Pagamento](#pagamento), [Nota](#nota).

### Consumo

**Definição:** O uso que os participantes fazem dos itens da copa (café, açúcar, leite, filtros, copos, bolachas e chás), dentro do que o tipo de cota permite.

**Regras:**
- Ninguém mede nem anota o consumo de cada participante; funciona na confiança.

**O gestor também diz:** "consumo regular", "itens da copa", "suprimentos".

**Relacionados:** [Participante](#participante), [Tipo de cota](#tipo-de-cota), [Copa](#copa).

### Copa

**Definição:** O espaço do departamento onde ficam a máquina de café e os itens de consumo e onde o pessoal se encontra.

**Regras:**
- Só quem participa usa a copa.
- O acesso não é controlado; funciona na confiança.

**Relacionados:** [Participante](#participante), [Consumo](#consumo).

### Cota

**Definição:** O valor que o participante deve por mês para participar da divisão dos custos, de acordo com o seu tipo de cota.

**Regras:**
- É devida todo mês, no início do mês, enquanto a pessoa participa.
- O valor é o do [tipo de cota](#tipo-de-cota) do participante naquele mês, conforme o [valor da cota](#valor-da-cota) do ano.
- Depois de devida, o valor não muda, mesmo que o participante troque de tipo ou saia.
- O gestor também chama de "cota" o tipo escolhido. Neste glossário, **Cota** é sempre o valor do mês e **[Tipo de cota](#tipo-de-cota)** é a modalidade.

**O gestor também diz:** "a cota de março".

**Relacionados:** [Tipo de cota](#tipo-de-cota), [Valor da cota](#valor-da-cota), [Pagamento](#pagamento), [Crédito](#crédito), [Pendente](#pendente).

### Crédito

**Definição:** O valor pago a mais por um participante, que fica guardado para abater as próximas cotas ou complementos dele.

**Regras:**
- É abatido automaticamente das próximas cotas e complementos do participante, sem que o gestor precise decidir.
- O dinheiro do crédito fica na caixinha, como todo pagamento.
- Na saída, os meses pagos adiantado viram crédito.
- O crédito não é devolvido em dinheiro; fica guardado para o participante usar quando retornar.

**Relacionados:** [Pagamento](#pagamento), [Cota](#cota), [Complemento](#complemento), [Caixinha](#caixinha), [Participante](#participante).

### Gasto

**Definição:** O dinheiro usado para manter a copa: compras de itens, conserto e manutenção da máquina de café e reposição de itens quebrados.

**Regras:**
- Todo gasto sai da caixinha.
- Quem paga um gasto do próprio bolso recebe [reembolso](#reembolso).

**O gestor também diz:** "despesa", "o que saiu".

**Relacionados:** [Compra](#compra), [Nota](#nota), [Reembolso](#reembolso), [Caixinha](#caixinha), [Valor da cota](#valor-da-cota).

### Gestor

**Definição:** O participante que organiza a divisão dos custos: avisa e cobra o pessoal, recebe os pagamentos, faz a maior parte das compras para manter a copa abastecida, cuida da caixinha e, quando falta dinheiro, calcula e pede o complemento.

**Regras:**
- É um papel, não uma pessoa à parte: o gestor também é um participante, com tipo de cota e cotas como os demais.
- Hoje é uma pessoa só.
- Só o gestor define o [valor da cota](#valor-da-cota), recebe [pagamentos](#pagamento), solicita [complementos](#complemento), faz [reembolsos](#reembolso) e desativa o acesso de um participante ao FACOFFEE.

**O gestor também diz:** "responsável".

**Relacionados:** [Participante](#participante), [Pagamento](#pagamento), [Compra](#compra), [Caixinha](#caixinha), [Complemento](#complemento), [Valor da cota](#valor-da-cota).

### Nota

**Definição:** A nota fiscal ou o recibo de um gasto, guardado para saber quanto foi gasto e para fazer o reembolso.

**Regras:**
- Basta o valor total; o gasto não precisa ser registrado item por item.

**O gestor também diz:** "notinha", "recibo", "cupom".

**Relacionados:** [Gasto](#gasto), [Compra](#compra), [Reembolso](#reembolso), [Comprovante](#comprovante).

### Pagamento

**Definição:** O dinheiro que o participante entrega ao gestor, por PIX ou em mãos, para quitar cotas ou um complemento.

**Regras:**
- Normalmente quita de uma vez as cotas de um semestre ou de um ano, no início do período.
- O que for pago a mais vira [crédito](#crédito).
- Todo pagamento entra na caixinha.
- O pagamento por PIX é acompanhado de [comprovante](#comprovante).

**O gestor também diz:** "acertar", "quitar", "acerto", "repasse".

**Relacionados:** [Cota](#cota), [Crédito](#crédito), [Complemento](#complemento), [Comprovante](#comprovante), [Pendente](#pendente), [Caixinha](#caixinha).

### Participante

**Definição:** Professor ou técnico administrativo da FACOM que, por vontade própria, participa da divisão dos custos com um tipo de cota.

**Regras:**
- Deixa de participar quando pede a saída ao gestor.
- Também deixa de participar quando o seu acesso ao FACOFFEE é desativado, seja pelo gestor, seja a pedido do próprio participante.
- Pode retornar depois de sair. O crédito, as cotas e os complementos não pagos ficam guardados para o retorno.

**O gestor também diz:** "o pessoal", "os colegas", "quem está na copa".

**Relacionados:** [Tipo de cota](#tipo-de-cota), [Cota](#cota), [Consumo](#consumo), [Copa](#copa), [Pendente](#pendente), [Crédito](#crédito), [Gestor](#gestor).

### Pendente

**Definição:** O participante que tem a cota de algum mês, até o atual, ou um complemento que não foi pago nem abatido do crédito.

**Regras:**
- As cotas não pagas se acumulam, mês a mês, até a saída do participante.
- Na saída, as cotas e os complementos não pagos ficam registrados como devidos.
- Pode continuar usando a copa e quitar depois.
- Não há multa nem juros; o gestor acompanha e lembra a pessoa até ela acertar.

**O gestor também diz:** "devendo", "em atraso".

**Relacionados:** [Cota](#cota), [Complemento](#complemento), [Pagamento](#pagamento), [Crédito](#crédito), [Participante](#participante).

### Reembolso

**Definição:** A devolução do que o gestor ou outro participante pagou do próprio bolso num gasto da copa: compra, conserto, manutenção ou reposição.

**Regras:**
- Sai da caixinha.
- Quem faz o reembolso é o gestor.

**Relacionados:** [Gasto](#gasto), [Compra](#compra), [Nota](#nota), [Caixinha](#caixinha), [Gestor](#gestor).

### Saldo da caixinha

**Definição:** Quanto dinheiro ainda está disponível na caixinha para as compras ou manutenções necessárias: tudo o que entrou menos tudo o que saiu.

**Regras:**
- Quando não é suficiente para os gastos, o gestor pede um [complemento](#complemento).

**O gestor também diz:** "o que sobrou".

**Relacionados:** [Caixinha](#caixinha), [Gasto](#gasto), [Complemento](#complemento).

### Tipo de cota

**Definição:** A modalidade que o participante escolhe e que define quais itens da copa ele pode consumir.

| Tipo | Valor mensal (ano vigente) | Dá direito a |
|---|---|---|
| **Só café** | R$ 25,00 | Café |
| **Completa** | R$ 30,00 | Café, bolachas, chás e os demais itens da copa |

**Regras:**
- A troca de tipo só vale a partir do mês seguinte.

**O gestor também diz:** "cota" ("ela está na cota completa").

**Relacionados:** [Cota](#cota), [Valor da cota](#valor-da-cota), [Consumo](#consumo).

### Valor da cota

**Definição:** O valor de cada tipo de cota, definido pelo gestor no início do ano com base nos gastos do ano anterior.

**Regras:**
- Não muda durante o ano.
- Os participantes são avisados quando o valor é definido.

**Relacionados:** [Tipo de cota](#tipo-de-cota), [Cota](#cota), [Gasto](#gasto), [Gestor](#gestor).

## Termos a evitar

| Termo evitado | Use | Motivo |
|---|---|---|
| Mensalidade, assinatura | [Cota](#cota) | O gestor diz que não existe mensalidade formal. |
| Taxa de pagamento, taxa reduzida | — | Não existem no domínio. |
| Lucro, reinvestimento | — | A divisão dos custos não tem lucro. |
| Estoque | [Consumo](#consumo), [Compra](#compra) | Não há controle de estoque. |
| Cliente, contribuinte, membro, funcionário | [Participante](#participante) | Não é como o gestor fala. |
| Usuário (para falar de quem participa) | [Participante](#participante) | No FACOFFEE, "usuário" é a conta de acesso, tratada no contexto Usuário. Ter acesso não faz de alguém um participante. |
| Administrador (para falar do gestor) | [Gestor](#gestor) | "Gestor" é o papel no domínio; perfis de acesso são termos da solução. |
| Cadastro, inscrição | — | Não há inscrição formal; a pessoa só avisa o gestor e escolhe o tipo de cota. |
| Cota simples, cota parcial | Só café ([Tipo de cota](#tipo-de-cota)) | O nome usado é "só café". |
| Rateio extra, cobrança extra | [Complemento](#complemento) | O nome usado é "complemento". |
| Saldo das cotas | [Saldo da caixinha](#saldo-da-caixinha) | Todo o dinheiro fica na caixinha; não existe outro saldo. |
| Comprovante (de gasto) | [Nota](#nota) | "Comprovante" vale só para pagamentos. |
| Pagamento realizado | Pagamento recebido | Quem registra o pagamento é o gestor, ao receber o dinheiro. |
| Notificação de cobrança, registro de pagamento, lançar pagamento, painel, relatório, status | — | São termos da solução, não do domínio. Pertencem ao modelo do sistema. |

## Questões em aberto

Nenhuma questão em aberto nesta versão.

## Histórico de revisões

| Versão | Data | Alterações |
|---|---|---|
| 1.0 | 2026-10-09 | Primeira versão, consolidada a partir dos glossários da atividade. |
| 1.1 | 2026-10-09 | [Reembolso](#reembolso) e [Nota](#nota) passam a valer para qualquer [gasto](#gasto), não só para compras, alinhando o glossário aos modelos de domínio. |
| 2.0 | 2026-10-24 | Revisão a partir da arquitetura do FACOFFEE. A [Visão por área](#visão-por-área) indica o contexto de cada termo. [Participante](#participante) também sai quando o acesso é desativado. [Complemento](#complemento) é dividido entre os participantes do momento da solicitação. [Gestor](#gestor) passa a ser descrito como papel de um participante, com as ações que só ele faz. [Cota](#cota) ganha regras sobre o valor do mês. "Usuário", "administrador" e "pagamento realizado" entram nos termos a evitar. Abertas as questões 1 e 2. |
| 2.1 | 2026-10-24 | Decisões: o [crédito](#crédito) é abatido automaticamente; o [complemento](#complemento) é dividido entre todos os participantes ativos; o acesso é desativado pelo [gestor](#gestor) ou a pedido do [participante](#participante), e isso encerra a participação. Questões 1 e 2 fechadas. |
