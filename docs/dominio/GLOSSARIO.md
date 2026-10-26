# Glossário da Linguagem Ubíqua: FACOFFEE

| | |
|---|---|
| **Escopo** | Divisão de custos da copa da FACOM |
| **Sistema** | FACOFFEE |
| **Disciplina** | Técnicas Avançadas de Desenvolvimento de Software (2026/2) |
| **Versão** | 2.10 |
| **Data** | 2026-10-26 |
| **Status** | Aprovado |

## Propósito

Este glossário define a linguagem ubíqua usada na divisão de custos da copa da FACOM, o domínio do sistema **FACOFFEE**. Os termos daqui devem ser usados, com o mesmo sentido, nas conversas com o especialista, nos modelos de domínio e no código.

## Fontes e método

- Entrevistas com o gestor da copa (proto-persona).
- Glossários entregues na atividade *System Design com Domain-Driven Design (DDD)*: 23 glossários distintos, entre individuais e de duplas.
- Entraram os termos que aparecem em pelo menos 6 dos 23 glossários. As definições foram conferidas com os fatos do domínio.
- Os termos [Crédito](#crédito) e [Complemento](#complemento) foram definidos para responder às questões levantadas durante a consolidação.
- A versão 2.0 incorpora as decisões tomadas no desenho da arquitetura do FACOFFEE ([arquitetura/visao-geral.png](../arquitetura/visao-geral.png)): a divisão em contextos, a saída por desativação do acesso e a divisão do complemento entre todos os participantes ativos.

## Convenções

- Os termos aparecem em ordem alfabética.
- **Definição**: o significado do termo dentro do escopo deste glossário.
- **Regras**: as regras de negócio ligadas ao termo. O texto de cada regra, com os cenários e os testes que a garantem, fica em [docs/requisitos/](../requisitos/README.md) ([ADR 0032](../adr/0032-requisitos-rastreaveis-em-bdd.md)); aqui ficam só o ID e o título.
- **O gestor também diz**: palavras que o especialista usa com o mesmo sentido. Valem na conversa, mas nos modelos e no código usa-se só o termo do glossário.
- **Relacionados**: outros termos do glossário ligados a este.

## Visão por área

A coluna **Contexto** indica em qual contexto do FACOFFEE o termo é tratado. Os contextos estão descritos nos [Modelos de Domínio](MODELOS.md#3-contextos-delimitados).

| Área | Termos | Contexto |
|---|---|---|
| Participação | [Participante](#participante), [Gestor](#gestor) | Participação |
| Cotas | [Cota](#cota), [Tipo de cota](#tipo-de-cota), [Valor da cota](#valor-da-cota) | Participação |
| Pagamento | [Pagamento](#pagamento), [Comprovante](#comprovante), [Crédito](#crédito), [Pendente](#pendente) | Financeiro |
| Gastos | [Gasto](#gasto), [Tipo de gasto](#tipo-de-gasto), [Compra](#compra), [Nota](#nota), [Reembolso](#reembolso) | Financeiro |
| Caixinha | [Caixinha](#caixinha), [Saldo da caixinha](#saldo-da-caixinha), [Complemento](#complemento) | Financeiro |
| Uso da copa | [Copa](#copa), [Consumo](#consumo) | Fora do sistema: o uso da copa não é registrado. |

Dois termos aparecem em mais de um contexto:

- **[Participante](#participante)**: em Participação, importa se a pessoa participa e com qual tipo de cota; em Financeiro, importa o que ela deve, o que foi quitado e o que tem de crédito.
- **[Cota](#cota)**: nasce em Participação, todo mês, e é cobrada em Financeiro.

## Termos

### Caixinha

**Definição:** O dinheiro da divisão dos custos. Tudo o que os participantes pagam entra na caixinha, e todo gasto sai dela.

**Regras:**
- [RN-FIN-30](../requisitos/financeiro/acompanhar-a-caixinha.md#rn-fin-30-todo-pagamento-entra-na-caixinha-todo-gasto-e-todo-reembolso-saem-dela) Todo pagamento entra na caixinha; todo gasto e todo reembolso saem dela
- [RN-FIN-31](../requisitos/financeiro/acompanhar-a-caixinha.md#rn-fin-31-a-caixinha-acumula-de-um-mês-para-o-outro) A caixinha acumula de um mês para o outro

**O gestor também diz:** "reserva", "fundo".

**Relacionados:** [Saldo da caixinha](#saldo-da-caixinha), [Pagamento](#pagamento), [Gasto](#gasto), [Complemento](#complemento).

### Complemento

**Definição:** O valor extra que o gestor pede aos participantes quando o saldo da caixinha não é suficiente para os gastos.

**Regras:**
- [RN-FIN-27](../requisitos/financeiro/solicitar-complemento.md#rn-fin-27-só-o-gestor-solicita-o-complemento-quando-o-saldo-da-caixinha-não-basta) Só o gestor solicita o complemento, quando o saldo da caixinha não basta
- [RN-FIN-28](../requisitos/financeiro/solicitar-complemento.md#rn-fin-28-o-complemento-é-dividido-em-partes-iguais-entre-os-participantes-ativos-no-momento-inclusive-os-pendentes) O complemento é dividido em partes iguais entre os participantes ativos no momento, inclusive os pendentes
- [RN-FIN-29](../requisitos/financeiro/solicitar-complemento.md#rn-fin-29-quem-entra-depois-da-solicitação-não-deve-parte-quem-sai-depois-continua-devendo-a-sua) Quem entra depois da solicitação não deve parte; quem sai depois continua devendo a sua
- [RN-FIN-30](../requisitos/financeiro/acompanhar-a-caixinha.md#rn-fin-30-todo-pagamento-entra-na-caixinha-todo-gasto-e-todo-reembolso-saem-dela) Todo pagamento entra na caixinha; todo gasto e todo reembolso saem dela
- [RN-FIN-16](../requisitos/financeiro/credito-e-pendentes.md#rn-fin-16-o-crédito-abate-automaticamente-as-próximas-cotas-e-complementos) O crédito abate automaticamente as próximas cotas e complementos
- [RN-FIN-17](../requisitos/financeiro/credito-e-pendentes.md#rn-fin-17-pendente-é-quem-tem-cota-ou-complemento-não-pago-nem-abatido-sem-multa-nem-juros) Pendente é quem tem cota ou complemento não pago nem abatido, sem multa nem juros

**Relacionados:** [Saldo da caixinha](#saldo-da-caixinha), [Caixinha](#caixinha), [Gestor](#gestor), [Pagamento](#pagamento), [Crédito](#crédito), [Pendente](#pendente).

### Compra

**Definição:** A aquisição de itens para abastecer a copa, feita conforme eles vão acabando.

**Regras:**
- [RN-FIN-26](../requisitos/financeiro/registrar-gasto-e-reembolsar.md#rn-fin-26-qualquer-participante-registra-um-gasto) Qualquer participante registra um gasto

**O gestor também diz:** "reposição".

**Relacionados:** [Gasto](#gasto), [Nota](#nota), [Reembolso](#reembolso).

### Comprovante

**Definição:** A prova de um pagamento por PIX, que o participante envia ao gestor ou que o gestor guarda ao receber o pagamento.

**Regras:**
- [RN-FIN-06](../requisitos/financeiro/receber-pagamento.md#rn-fin-06-comprovante-é-de-pagamento-o-documento-de-um-gasto-é-a-nota) Comprovante é de pagamento; o documento de um gasto é a nota
- [RN-FIN-05](../requisitos/financeiro/receber-pagamento.md#rn-fin-05-o-comprovante-fica-guardado-junto-do-pagamento-e-vale-para-um-pagamento-só) O comprovante fica guardado junto do pagamento e vale para um pagamento só
- [RN-FIN-04](../requisitos/financeiro/receber-pagamento.md#rn-fin-04-o-comprovante-é-do-participante-e-só-ele-e-o-gestor-o-veem) O comprovante é do participante, e só ele e o gestor o veem
- [RN-FIN-07](../requisitos/financeiro/enviar-comprovante.md#rn-fin-07-comprovante-a-confirmar-não-é-pagamento) Comprovante a confirmar não é pagamento
- [RN-FIN-08](../requisitos/financeiro/enviar-comprovante.md#rn-fin-08-o-gestor-confirma-ou-recusa-o-comprovante-enviado-uma-vez-só) O gestor confirma ou recusa o comprovante enviado, uma vez só
- [RN-FIN-09](../requisitos/financeiro/enviar-comprovante.md#rn-fin-09-ao-confirmar-o-gestor-recebe-o-pagamento-e-vale-o-valor-confirmado) Ao confirmar, o gestor recebe o pagamento e vale o valor confirmado
- [RN-FIN-10](../requisitos/financeiro/enviar-comprovante.md#rn-fin-10-a-recusa-tem-motivo-que-o-participante-vê) A recusa tem motivo, que o participante vê
- [RN-FIN-11](../requisitos/financeiro/enviar-comprovante.md#rn-fin-11-enquanto-a-confirmar-o-participante-edita-ou-cancela-o-envio-depois-não) Enquanto a confirmar, o participante edita ou cancela o envio; depois, não
- [RN-FIN-12](../requisitos/financeiro/enviar-comprovante.md#rn-fin-12-o-gestor-só-confirma-o-arquivo-que-conferiu) O gestor só confirma o arquivo que conferiu
- [RN-FIN-13](../requisitos/financeiro/enviar-comprovante.md#rn-fin-13-o-participante-guarda-comprovante-só-para-si-o-gestor-para-qualquer-participante) O participante guarda comprovante só para si; o gestor, para qualquer participante
- [RN-NOT-05](../requisitos/notificacao/avisar-os-participantes.md#rn-not-05-comprovante-enviado-avisa-cada-gestor-com-quem-enviou-e-o-valor) Comprovante enviado avisa cada gestor, com quem enviou e o valor
- [RN-NOT-06](../requisitos/notificacao/avisar-os-participantes.md#rn-not-06-comprovante-recusado-avisa-o-participante-com-o-valor-e-o-motivo) Comprovante recusado avisa o participante, com o valor e o motivo

**Relacionados:** [Pagamento](#pagamento), [Nota](#nota).

### Consumo

**Definição:** O uso que os participantes fazem dos itens da copa (café, açúcar, leite, filtros, copos, bolachas e chás), dentro do que o tipo de cota permite.

**Regras:**
- [RNF-11](../requisitos/nao-funcionais.md#rnf-11-confiança-no-consumo-o-uso-da-copa-fica-fora-do-facoffee) Confiança no consumo: o uso da copa fica fora do FACOFFEE

**O gestor também diz:** "consumo regular", "itens da copa", "suprimentos".

**Relacionados:** [Participante](#participante), [Tipo de cota](#tipo-de-cota), [Copa](#copa).

### Copa

**Definição:** O espaço do departamento onde ficam a máquina de café e os itens de consumo e onde o pessoal se encontra.

**Regras:**
- [RNF-11](../requisitos/nao-funcionais.md#rnf-11-confiança-no-consumo-o-uso-da-copa-fica-fora-do-facoffee) Confiança no consumo: o uso da copa fica fora do FACOFFEE

**Relacionados:** [Participante](#participante), [Consumo](#consumo).

### Cota

**Definição:** O valor que o participante deve por mês para participar da divisão dos custos, de acordo com o seu tipo de cota.

**Regras:**
- [RN-PAR-09](../requisitos/participacao/dever-a-cota-do-mes.md#rn-par-09-a-cota-é-devida-todo-início-de-mês-enquanto-a-pessoa-participa) A cota é devida todo início de mês enquanto a pessoa participa
- [RN-PAR-10](../requisitos/participacao/dever-a-cota-do-mes.md#rn-par-10-quem-entra-durante-o-mês-também-deve-a-cota-daquele-mês) Quem entra durante o mês também deve a cota daquele mês
- [RN-PAR-11](../requisitos/participacao/dever-a-cota-do-mes.md#rn-par-11-o-valor-da-cota-é-o-do-tipo-de-cota-do-participante-naquele-mês-conforme-o-valor-do-ano) O valor da cota é o do tipo de cota do participante naquele mês, conforme o valor do ano
- [RN-PAR-12](../requisitos/participacao/dever-a-cota-do-mes.md#rn-par-12-depois-de-devida-a-cota-não-muda) Depois de devida, a cota não muda

**O gestor também diz:** "a cota de março". Também chama de "cota" o tipo escolhido; neste glossário, **Cota** é sempre o valor do mês e **[Tipo de cota](#tipo-de-cota)** é a modalidade.

**Relacionados:** [Tipo de cota](#tipo-de-cota), [Valor da cota](#valor-da-cota), [Pagamento](#pagamento), [Crédito](#crédito), [Pendente](#pendente).

### Crédito

**Definição:** O valor pago a mais por um participante, que fica guardado para abater as próximas cotas ou complementos dele.

**Regras:**
- [RN-FIN-15](../requisitos/financeiro/credito-e-pendentes.md#rn-fin-15-o-que-for-pago-a-mais-vira-crédito) O que for pago a mais vira crédito
- [RN-FIN-16](../requisitos/financeiro/credito-e-pendentes.md#rn-fin-16-o-crédito-abate-automaticamente-as-próximas-cotas-e-complementos) O crédito abate automaticamente as próximas cotas e complementos
- [RN-FIN-18](../requisitos/financeiro/credito-e-pendentes.md#rn-fin-18-crédito-e-pendência-continuam-valendo-na-saída-e-no-retorno) Crédito e pendência continuam valendo na saída e no retorno
- [RN-FIN-21](../requisitos/financeiro/credito-e-pendentes.md#rn-fin-21-o-crédito-não-é-devolvido-em-dinheiro) O crédito não é devolvido em dinheiro

**Relacionados:** [Pagamento](#pagamento), [Cota](#cota), [Complemento](#complemento), [Caixinha](#caixinha), [Participante](#participante).

### Gasto

**Definição:** O dinheiro usado para manter a copa: compras de itens, conserto e manutenção da máquina de café e reposição de itens quebrados.

**Regras:**
- [RN-FIN-30](../requisitos/financeiro/acompanhar-a-caixinha.md#rn-fin-30-todo-pagamento-entra-na-caixinha-todo-gasto-e-todo-reembolso-saem-dela) Todo pagamento entra na caixinha; todo gasto e todo reembolso saem dela
- [RN-FIN-24](../requisitos/financeiro/registrar-gasto-e-reembolsar.md#rn-fin-24-gasto-pago-do-próprio-bolso-gera-reembolso-e-só-sai-da-caixinha-no-reembolso) Gasto pago do próprio bolso gera reembolso, e só sai da caixinha no reembolso
- [RN-FIN-22](../requisitos/financeiro/registrar-gasto-e-reembolsar.md#rn-fin-22-todo-gasto-tem-um-só-tipo-de-gasto) Todo gasto tem um só tipo de gasto

**O gestor também diz:** "despesa", "o que saiu".

**Relacionados:** [Tipo de gasto](#tipo-de-gasto), [Compra](#compra), [Nota](#nota), [Reembolso](#reembolso), [Caixinha](#caixinha), [Valor da cota](#valor-da-cota).

### Gestor

**Definição:** O participante que organiza a divisão dos custos: avisa e cobra o pessoal, recebe os pagamentos, faz a maior parte das compras para manter a copa abastecida, cuida da caixinha e, quando falta dinheiro, calcula e pede o complemento.

**Regras:**
- [RN-PAR-04](../requisitos/participacao/entrar-na-copa.md#rn-par-04-o-gestor-é-um-papel-de-participante) O gestor é um papel de participante
- [RN-PAR-13](../requisitos/participacao/definir-o-valor-da-cota.md#rn-par-13-só-o-gestor-define-o-valor-da-cota) Só o gestor define o valor da cota
- [RN-FIN-01](../requisitos/financeiro/receber-pagamento.md#rn-fin-01-só-o-gestor-recebe-pagamentos) Só o gestor recebe pagamentos
- [RN-FIN-08](../requisitos/financeiro/enviar-comprovante.md#rn-fin-08-o-gestor-confirma-ou-recusa-o-comprovante-enviado-uma-vez-só) O gestor confirma ou recusa o comprovante enviado, uma vez só
- [RN-FIN-27](../requisitos/financeiro/solicitar-complemento.md#rn-fin-27-só-o-gestor-solicita-o-complemento-quando-o-saldo-da-caixinha-não-basta) Só o gestor solicita o complemento, quando o saldo da caixinha não basta
- [RN-FIN-25](../requisitos/financeiro/registrar-gasto-e-reembolsar.md#rn-fin-25-só-o-gestor-reembolsa-uma-vez-por-gasto) Só o gestor reembolsa, uma vez por gasto
- [RN-USU-01](../requisitos/usuario/acesso-ao-facoffee.md#rn-usu-01-o-acesso-é-desativado-pelo-gestor-ou-a-pedido-da-própria-pessoa-só-o-gestor-desativa-outra) O acesso é desativado pelo gestor ou a pedido da própria pessoa; só o gestor desativa outra

**O gestor também diz:** "responsável".

**Relacionados:** [Participante](#participante), [Pagamento](#pagamento), [Compra](#compra), [Caixinha](#caixinha), [Complemento](#complemento), [Valor da cota](#valor-da-cota).

### Nota

**Definição:** A nota fiscal ou o recibo de um gasto, guardado para saber quanto foi gasto e para fazer o reembolso.

**Regras:**
- [RN-FIN-23](../requisitos/financeiro/registrar-gasto-e-reembolsar.md#rn-fin-23-todo-gasto-tem-nota-com-o-valor-total) Todo gasto tem nota, com o valor total

**O gestor também diz:** "notinha", "recibo", "cupom".

**Relacionados:** [Gasto](#gasto), [Compra](#compra), [Reembolso](#reembolso), [Comprovante](#comprovante).

### Pagamento

**Definição:** O dinheiro que o gestor recebe, por PIX ou em mãos, para quitar as cotas ou um complemento de um participante.

**Regras:**
- [RN-FIN-15](../requisitos/financeiro/credito-e-pendentes.md#rn-fin-15-o-que-for-pago-a-mais-vira-crédito) O que for pago a mais vira crédito
- [RN-FIN-30](../requisitos/financeiro/acompanhar-a-caixinha.md#rn-fin-30-todo-pagamento-entra-na-caixinha-todo-gasto-e-todo-reembolso-saem-dela) Todo pagamento entra na caixinha; todo gasto e todo reembolso saem dela
- [RN-FIN-02](../requisitos/financeiro/receber-pagamento.md#rn-fin-02-o-pagamento-por-pix-é-acompanhado-de-comprovante-em-dinheiro-não) O pagamento por PIX é acompanhado de comprovante; em dinheiro, não
- [RN-FIN-09](../requisitos/financeiro/enviar-comprovante.md#rn-fin-09-ao-confirmar-o-gestor-recebe-o-pagamento-e-vale-o-valor-confirmado) Ao confirmar, o gestor recebe o pagamento e vale o valor confirmado
- [RN-FIN-07](../requisitos/financeiro/enviar-comprovante.md#rn-fin-07-comprovante-a-confirmar-não-é-pagamento) Comprovante a confirmar não é pagamento
- [RN-FIN-03](../requisitos/financeiro/receber-pagamento.md#rn-fin-03-o-pagamento-pertence-ao-participante-cujas-cotas-ele-quita) O pagamento pertence ao participante cujas cotas ele quita

**O gestor também diz:** "acertar", "quitar", "acerto", "repasse".

**Relacionados:** [Cota](#cota), [Crédito](#crédito), [Complemento](#complemento), [Comprovante](#comprovante), [Pendente](#pendente), [Caixinha](#caixinha).

### Participante

**Definição:** Professor ou técnico administrativo da FACOM que, por vontade própria, participa da divisão dos custos com um tipo de cota.

**Regras:**
- [RN-PAR-07](../requisitos/participacao/sair-da-copa.md#rn-par-07-deixa-de-participar-quem-pede-a-saída) Deixa de participar quem pede a saída
- [RN-PAR-08](../requisitos/participacao/sair-da-copa.md#rn-par-08-o-acesso-desativado-encerra-a-participação) O acesso desativado encerra a participação
- [RN-PAR-03](../requisitos/participacao/entrar-na-copa.md#rn-par-03-retornar-é-entrar-de-novo) Retornar é entrar de novo
- [RN-FIN-18](../requisitos/financeiro/credito-e-pendentes.md#rn-fin-18-crédito-e-pendência-continuam-valendo-na-saída-e-no-retorno) Crédito e pendência continuam valendo na saída e no retorno

**O gestor também diz:** "o pessoal", "os colegas", "quem está na copa".

**Relacionados:** [Tipo de cota](#tipo-de-cota), [Cota](#cota), [Consumo](#consumo), [Copa](#copa), [Pendente](#pendente), [Crédito](#crédito), [Gestor](#gestor).

### Pendente

**Definição:** O participante que tem a cota de algum mês, até o atual, ou um complemento que não foi pago nem abatido do crédito.

**Regras:**
- [RN-FIN-17](../requisitos/financeiro/credito-e-pendentes.md#rn-fin-17-pendente-é-quem-tem-cota-ou-complemento-não-pago-nem-abatido-sem-multa-nem-juros) Pendente é quem tem cota ou complemento não pago nem abatido, sem multa nem juros
- [RN-FIN-18](../requisitos/financeiro/credito-e-pendentes.md#rn-fin-18-crédito-e-pendência-continuam-valendo-na-saída-e-no-retorno) Crédito e pendência continuam valendo na saída e no retorno
- [RN-NOT-08](../requisitos/notificacao/lembrar-os-pendentes.md#rn-not-08-a-partir-do-dia-10-cada-participante-ativo-pendente-é-lembrado-uma-vez-no-mês-só-da-própria-situação) A partir do dia 10, cada participante ativo pendente é lembrado uma vez no mês, só da própria situação

**O gestor também diz:** "devendo", "em atraso".

**Relacionados:** [Cota](#cota), [Complemento](#complemento), [Pagamento](#pagamento), [Crédito](#crédito), [Participante](#participante).

### Reembolso

**Definição:** A devolução do que o gestor ou outro participante pagou do próprio bolso num gasto da copa: compra, conserto, manutenção ou reposição.

**Regras:**
- [RN-FIN-30](../requisitos/financeiro/acompanhar-a-caixinha.md#rn-fin-30-todo-pagamento-entra-na-caixinha-todo-gasto-e-todo-reembolso-saem-dela) Todo pagamento entra na caixinha; todo gasto e todo reembolso saem dela
- [RN-FIN-25](../requisitos/financeiro/registrar-gasto-e-reembolsar.md#rn-fin-25-só-o-gestor-reembolsa-uma-vez-por-gasto) Só o gestor reembolsa, uma vez por gasto

**Relacionados:** [Gasto](#gasto), [Compra](#compra), [Nota](#nota), [Caixinha](#caixinha), [Gestor](#gestor).

### Saldo da caixinha

**Definição:** Quanto dinheiro ainda está disponível na caixinha para as compras ou manutenções necessárias: tudo o que entrou menos tudo o que saiu.

**Regras:**
- [RN-FIN-27](../requisitos/financeiro/solicitar-complemento.md#rn-fin-27-só-o-gestor-solicita-o-complemento-quando-o-saldo-da-caixinha-não-basta) Só o gestor solicita o complemento, quando o saldo da caixinha não basta

**O gestor também diz:** "o que sobrou".

**Relacionados:** [Caixinha](#caixinha), [Gasto](#gasto), [Complemento](#complemento).

### Tipo de cota

**Definição:** A modalidade que o participante escolhe e que define quais itens da copa ele pode consumir.

| Tipo | Valor mensal (ano vigente) | Dá direito a |
|---|---|---|
| **Só café** | R$ 25,00 | Café |
| **Completa** | R$ 30,00 | Café, bolachas, chás e os demais itens da copa |

**Regras:**
- [RN-PAR-05](../requisitos/participacao/trocar-tipo-de-cota.md#rn-par-05-a-troca-de-tipo-só-vale-a-partir-do-mês-seguinte) A troca de tipo só vale a partir do mês seguinte

**O gestor também diz:** "cota" ("ela está na cota completa").

**Relacionados:** [Cota](#cota), [Valor da cota](#valor-da-cota), [Consumo](#consumo).

### Tipo de gasto

**Definição:** Com o que foi o gasto, para mostrar a todos quanto saiu da caixinha com cada coisa.

| Tipo | O que inclui |
|---|---|
| **Café** | O café. |
| **Outros itens da copa** | Açúcar, leite, filtros, copos, bolachas, chás e os demais itens de consumo. |
| **Conserto e manutenção** | Conserto e manutenção da máquina de café. |
| **Reposição** | Reposição de itens quebrados. Não é a reposição dos itens que acabam, que é uma [compra](#compra) de café ou de outros itens da copa. |

**Regras:**
- [RN-FIN-22](../requisitos/financeiro/registrar-gasto-e-reembolsar.md#rn-fin-22-todo-gasto-tem-um-só-tipo-de-gasto) Todo gasto tem um só tipo de gasto

**O gestor também diz:** "tipo de coisa".

**Relacionados:** [Gasto](#gasto), [Compra](#compra), [Consumo](#consumo), [Tipo de cota](#tipo-de-cota).

### Valor da cota

**Definição:** O valor de cada tipo de cota, definido pelo gestor no início do ano com base nos gastos do ano anterior.

**Regras:**
- [RN-PAR-14](../requisitos/participacao/definir-o-valor-da-cota.md#rn-par-14-o-valor-da-cota-não-muda-durante-o-ano) O valor da cota não muda durante o ano
- [RN-PAR-15](../requisitos/participacao/definir-o-valor-da-cota.md#rn-par-15-sem-definição-até-o-início-do-ano-repete-se-o-valor-do-ano-anterior) Sem definição até o início do ano, repete-se o valor do ano anterior
- [RN-NOT-01](../requisitos/notificacao/avisar-os-participantes.md#rn-not-01-os-participantes-são-avisados-quando-o-valor-da-cota-é-definido) Os participantes são avisados quando o valor da cota é definido

**Relacionados:** [Tipo de cota](#tipo-de-cota), [Cota](#cota), [Gasto](#gasto), [Gestor](#gestor).

## Nomes nos contratos de eventos

Os contratos dos eventos trocados entre os contextos ([`contracts/events/`](../../contracts/events/)) usam nomes em inglês ([ADR 0006](../adr/0006-contratos-dos-eventos-em-ingles.md)). O nome em português continua valendo nas conversas, nos modelos e no código de cada contexto.

Estas tabelas são a única fonte das traduções: cada termo tem um só nome nos contratos, e os testes de `contracts/` recusam tipo de evento, campo ou valor com palavra que não esteja aqui. Para usar um termo novo num contrato, registre-o aqui primeiro.

### Termos

| Termo | Nos contratos | Observação |
|---|---|---|
| Usuário (contexto) | `user` | |
| Participação (contexto) | `participation` | |
| Financeiro (contexto) | `finance` | |
| Notificação (contexto) | `notification` | |
| Identificador | `id` | |
| [Usuário](#termos-a-evitar) (conta de acesso) | `user` | |
| [Participante](#participante) | `participant` | |
| [Cota](#cota) | `contribution` | Não `quota`: em inglês, *quota* é limite ou cota de alocação (falso cognato). Nem `fee`, `dues` ou `subscription`, que equivalem a mensalidade e assinatura, termos a evitar. |
| [Tipo de cota](#tipo-de-cota) | `contributionType` | |
| Só café, Completa | `coffee-only`, `full` | |
| [Valor da cota](#valor-da-cota) | `contribution-amount` | |
| Valor (em centavos) | `amountInCents` | Não `value` nem `price`. |
| Valor total (em centavos) | `totalAmountInCents` | |
| Mês, ano | `month`, `year` | |
| [Pagamento](#pagamento) | `payment` | |
| Forma do pagamento | `method` | |
| PIX, dinheiro | `pix`, `cash` | "Dinheiro" é o pagamento em mãos, não *money*. |
| [Comprovante](#comprovante) | `receipt` | Inclusive o comprovante enviado pelo participante. Não `proof`. |
| Motivo (da recusa) | `reason` | |
| [Complemento](#complemento) | `top-up` | O valor extra que repõe a caixinha. Não `complement` (falso cognato) nem `supplement`. |
| Parte (do complemento) | `share` | |
| [Reembolso](#reembolso) | `reimbursement` | Devolve a quem pagou um gasto do próprio bolso. Não `refund`, que é a devolução do valor de uma compra. |
| [Gasto](#gasto) | `expense` | |
| [Tipo de gasto](#tipo-de-gasto) | `expenseType` | |
| Café, outros itens da copa, conserto e manutenção, reposição | `coffee`, `other-supplies`, `repair-and-maintenance`, `replacement` | |

### Eventos

O tipo do evento nos contratos é `<contexto>.<evento>`, com o contexto de origem da tabela de termos.

| Evento | Nos contratos |
|---|---|
| Usuário desativado | `user-deactivated` |
| Participante entrou | `participant-joined` |
| Participante saiu | `participant-left` |
| Cota devida | `contribution-due` |
| Valor da cota definido | `contribution-amount-set` |
| Pagamento recebido | `payment-received` |
| Complemento solicitado | `top-up-requested` |
| Reembolso feito | `reimbursement-made` |
| Comprovante enviado | `receipt-sent` |
| Comprovante recusado | `receipt-rejected` |

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
| Pagamento realizado | Pagamento recebido | Quem registra o pagamento é o gestor, ao receber o dinheiro ou confirmar o comprovante. |
| Aprovar, validar, rejeitar (comprovante) | Confirmar, recusar ([Comprovante](#comprovante)) | São os termos das regras validadas com o gestor. |
| Notificação de cobrança, registro de pagamento, lançar pagamento, painel, relatório, status | — | São termos da solução, não do domínio. Pertencem ao modelo do sistema. |

## Questões em aberto

Nenhuma.

## Histórico de revisões

| Versão | Data | Alterações |
|---|---|---|
| 1.0 | 2026-10-09 | Primeira versão, consolidada a partir dos glossários da atividade. |
| 1.1 | 2026-10-09 | [Reembolso](#reembolso) e [Nota](#nota) passam a valer para qualquer [gasto](#gasto), não só para compras, alinhando o glossário aos modelos de domínio. |
| 2.0 | 2026-10-24 | Revisão a partir da arquitetura do FACOFFEE. A [Visão por área](#visão-por-área) indica o contexto de cada termo. [Participante](#participante) também sai quando o acesso é desativado. [Complemento](#complemento) é dividido entre os participantes do momento da solicitação. [Gestor](#gestor) passa a ser descrito como papel de um participante, com as ações que só ele faz. [Cota](#cota) ganha regras sobre o valor do mês. "Usuário", "administrador" e "pagamento realizado" entram nos termos a evitar. Abertas as questões 1 e 2. |
| 2.1 | 2026-10-24 | Decisões: o [crédito](#crédito) é abatido automaticamente; o [complemento](#complemento) é dividido entre todos os participantes ativos; o acesso é desativado pelo [gestor](#gestor) ou a pedido do [participante](#participante), e isso encerra a participação. Questões 1 e 2 fechadas. |
| 2.2 | 2026-10-25 | Nova seção [Nomes nos contratos de eventos](#nomes-nos-contratos-de-eventos), com o nome em inglês de cada termo e evento usado nos contratos de eventos. |
| 2.3 | 2026-10-25 | [Cota](#cota): quem entra durante o mês também deve a cota daquele mês. [Valor da cota](#valor-da-cota): sem definição do gestor até o início do ano, repete-se o valor do ano anterior. |
| 2.4 | 2026-10-25 | Abertas as questões 1 (tipo do gasto, #73) e 2 (pagamento feito por outra pessoa, #74), levantadas na [Visão de produto](../produto/VISAO.md). |
| 2.5 | 2026-10-26 | Novo termo [Tipo de gasto](#tipo-de-gasto) (café, outros itens da copa, conserto e manutenção, reposição), validado com o gestor, com o nome nos contratos. Todo [gasto](#gasto) tem um tipo. Questão 1 fechada (#73). |
| 2.6 | 2026-10-26 | Validado com o gestor: o [pagamento](#pagamento) e o [comprovante](#comprovante) pertencem ao participante cujas cotas são quitadas, mesmo quando outra pessoa paga; quem pagou não é guardado; cada pagamento quita as cotas de um participante só. Questão 2 fechada (#74). |
| 2.7 | 2026-10-26 | [Pendente](#pendente): o FACOFFEE lembra o participante ativo pendente uma vez por mês, e o gestor só acompanha ([ADR 0027](../adr/0027-lembrete-aos-pendentes.md), #72). |
| 2.8 | 2026-10-26 | Validado com o gestor: o participante envia o próprio [comprovante](#comprovante), que fica a confirmar até o gestor confirmar, com o valor corrigido se preciso, ou recusar, com o motivo; enquanto a confirmar, o participante edita ou cancela o envio. [Pagamento](#pagamento) e [Gestor](#gestor) ganham a confirmação do comprovante. "Aprovar" e "rejeitar" comprovante entram nos termos a evitar ([ADR 0030](../adr/0030-pagamento-iniciado-pelo-participante.md), #87). |
| 2.9 | 2026-10-26 | [Comprovante](#comprovante): o FACOFFEE avisa o gestor de cada comprovante enviado e o participante da confirmação ou da recusa. Novos nomes nos contratos: comprovante (`receipt`), motivo (`reason`) e os eventos *Comprovante enviado* e *Comprovante recusado* ([ADR 0031](../adr/0031-avisos-do-comprovante-enviado.md), #88). |
| 2.10 | 2026-10-26 | As seções **Regras** passam a apontar para as regras de negócio em [docs/requisitos/](../requisitos/README.md), por ID, sem repetir o texto ([ADR 0032](../adr/0032-requisitos-rastreaveis-em-bdd.md), #96). |
