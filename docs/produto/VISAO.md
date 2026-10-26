# Visão de Produto: FACOFFEE

| | |
|---|---|
| **Escopo** | Divisão de custos da copa da FACOM |
| **Sistema** | FACOFFEE |
| **Disciplina** | Técnicas Avançadas de Desenvolvimento de Software (2026/2) |
| **Versão** | 1.0 |
| **Data** | 2026-10-25 |
| **Status** | Proposto |
| **Base** | [Glossário](../dominio/GLOSSARIO.md) (versão 2.3) e [Modelos de Domínio](../dominio/MODELOS.md) (versão 2.5) |

## Propósito

Este documento descreve **por que** o FACOFFEE existe, **para quem** e **como saber se ele deu certo**. O glossário e os modelos de domínio descrevem as regras; aqui ficam o problema, as pessoas, as prioridades e os limites do produto.

Os termos do domínio seguem o [Glossário](../dominio/GLOSSARIO.md). Termos da solução (lembrete, resumo, tela) aparecem só aqui, nunca nos modelos de domínio.

## Fontes e método

- Entrevista com o gestor da copa (proto-persona *Andrew*), em 2026-10-25, focada em rotina, dores, prioridades e limites.
- Fatos já registrados no glossário e nos modelos de domínio.
- Os números da seção [Situação atual](#situação-atual) são estimativas do gestor, não medições.

## Problema

A divisão dos custos da copa é um combinado informal entre colegas, e toda a operação depende de uma pessoa só: o gestor. Ele cobra, recebe, confere, compra, reembolsa e presta contas usando mensagens do WhatsApp, anotações soltas e a própria memória.

Isso gera:

- **Retrabalho:** lembrar a mesma pessoa várias vezes e caçar comprovantes espalhados nas conversas.
- **Incerteza:** dúvida sobre quem pagou, principalmente em dinheiro, que não deixa registro. Já houve cobrança de quem tinha pagado.
- **Desconforto:** cobrar colegas e amigos é o que mais desgasta o gestor.
- **Pouca transparência:** o pessoal pergunta se está em dia, quanto tem na caixinha e por que a cota tem aquele valor, e o gestor não tem como mostrar isso com facilidade.

> "Eu só quero manter as cotas da copa organizadas, com uma divisão justa, uma reserva para eventualidades e sem precisar ficar cobrando todo mundo o tempo inteiro." — Andrew

## Pessoas

### Gestor (persona principal)

Andrew, responsável pela copa dos servidores da FACOM. Também é participante, com tipo de cota como os demais.

- **Perfil:** prático, objetivo, prefere processos rápidos e fáceis de conferir. Centraliza tudo porque isso lhe dá controle, mas a carga fica com ele.
- **Ferramentas hoje:** principalmente o celular (WhatsApp); às vezes o computador. Anotações em arquivos e mensagens, sem um lugar só.
- **Quer saber com clareza:** quem participa, com qual tipo de cota, quem pagou e quem está pendente, quanto foi gasto e com o quê, e o saldo da caixinha.
- **Não quer:** que a copa vire tarefa cansativa ou motivo de atrito.

### Participante

Professor ou técnico administrativo da FACOM que participa por vontade própria.

- **Quer saber:** se está em dia, quanto tem na caixinha e por que a cota tem aquele valor.
- **Não quer:** ser exposto, pressionado ou ter mais trabalho do que hoje.
- **Comunicação:** grupo do WhatsApp para avisos gerais; conversa individual para comprovantes e cobranças; dinheiro entregue em mãos.

## Situação atual

| Indicador | Hoje |
|---|---|
| Participantes | ~25 (~15 completa, ~10 só café) |
| Tempo do gestor com a copa | 3 a 4 horas por mês, a maior parte cobrando e conferindo pagamentos |
| Lembretes até a pessoa pagar | 2 a 3, às vezes mais |
| Pendentes no meio do mês | 4 a 5 |
| Complementos solicitados | 1 até hoje (conserto maior da máquina) |
| Substituto do gestor | Nenhum formal; quando ele viaja, outros colegas ajudam informalmente |

### Momentos críticos

| Momento | O que acontece | Por que pesa |
|---|---|---|
| **Início do mês** | O gestor avisa no grupo que a cobrança começou e depois cobra individualmente quem não pagou. | É a pior época: correr atrás de pagamento e de comprovante. |
| **Início do ano** | O gestor olha os gastos do ano anterior, define o valor de cada tipo de cota, avisa no grupo e explica de novo a quem pergunta. | Precisa justificar os dois tipos de cota e a parte da caixinha, uma pessoa por vez. |
| **Fim do mês** | O gestor gostaria de mostrar quanto entrou, quanto saiu e quanto sobrou. | Hoje não consegue montar isso com facilidade. |
| **Entrada de alguém** | A pessoa procura o gestor, ouve a explicação dos tipos de cota, escolhe um, paga a cota do mês cheia, entra no grupo e o gestor anota nome e tipo de cota. | Mais uma anotação solta e mais uma explicação repetida. |

### Como o gestor confere um pagamento por PIX

1. O valor bate com a cota da pessoa.
2. O comprovante é do mês certo.
3. O nome é de quem mandou, porque às vezes alguém paga por outro.

## Prioridades

Ordem dada pelo gestor:

1. **Cobrança e conferência de pagamentos.** Parar de correr atrás de comprovante e acabar com a dúvida sobre quem pagou, inclusive em dinheiro.
2. **Prestação de contas do mês.** Mostrar a todos quanto entrou, quanto foi gasto e quanto sobrou na caixinha.
3. **Autoatendimento do participante.** Cada um ver sozinho se está em dia, sem perguntar ao gestor.
4. **Explicação dos valores.** Mostrar de onde vem o valor de cada tipo de cota, com base nos gastos do ano anterior.

## Objetivos e métricas de sucesso

> "Eu não precisaria lembrar ninguém várias vezes nem ficar procurando comprovante no WhatsApp. E no fim do mês eu saberia na hora quem pagou, quanto gastei e quanto tem na caixinha." — Andrew

| Objetivo | Métrica | Hoje | Meta em 6 meses |
|---|---|---|---|
| Menos esforço do gestor | Horas por mês com a copa | 3 a 4 h | até 1 h |
| Menos cobrança pessoal | Lembretes enviados pelo gestor, por pessoa, até ela pagar | 2 a 3 | 0 (lembretes saem do FACOFFEE) |
| Pagamento em dia | Pendentes no meio do mês | 4 a 5 | até 2 |
| Nenhuma dúvida sobre quem pagou | Cobranças indevidas (de quem já tinha pagado) | acontecem | 0 |
| Transparência | Resumo do mês disponível a todos | não existe | todo mês, sem trabalho manual |
| Menos perguntas repetidas | Perguntas ao gestor sobre "estou em dia?" e saldo da caixinha | frequentes | raras |

As metas são propostas da equipe, para validar com o gestor.

## Princípios de produto

O que não pode mudar, mesmo com o FACOFFEE:

1. **Continua um combinado entre colegas.** Voluntário, sem multa, sem juros, sem cara de cobrança formal.
2. **Leve.** Não pode dar mais trabalho ao gestor nem ao pessoal do que dá hoje. Se pesar, o gestor desiste.
3. **Ninguém é exposto.** Cada participante vê só a própria situação. A lista de quem está pendente é só do gestor.
4. **Só o gestor confirma pagamento.** É ele quem recebe, inclusive o dinheiro em mãos; nenhum colega declara que outro pagou.
5. **Transparência no agregado.** A caixinha é de todos: total que entrou, gastos por tipo e saldo ficam visíveis a todos. Notas, só a pedido.
6. **Lembrar sem pressionar.** Lembretes devem tirar o peso da cobrança do gestor sem constranger o colega.
7. **Confiança no consumo.** O consumo não é medido nem controlado.

## O que o produto precisa garantir

Cada necessidade aponta para onde o domínio já a trata.

| Necessidade | Para quem | Onde no domínio |
|---|---|---|
| Saber quem participa e com qual tipo de cota | Gestor | Contexto Participação: [Participante](../dominio/GLOSSARIO.md#participante), [Tipo de cota](../dominio/GLOSSARIO.md#tipo-de-cota) |
| Saber quem está pendente, sem caçar comprovante | Gestor | Leitura *Crédito e pendentes* (Financeiro) |
| Registrar pagamento por PIX (com comprovante) ou em dinheiro | Gestor | Comando *Receber pagamento*; [Comprovante](../dominio/GLOSSARIO.md#comprovante) |
| Aceitar pagamento adiantado de semestre ou ano | Gestor | [Crédito](../dominio/GLOSSARIO.md#crédito) abatido automaticamente |
| Ver a própria situação (em dia, pendente, crédito) | Participante | Leitura *Crédito e pendentes*, só a do próprio participante |
| Lembrar quem está pendente sem o gestor cobrar | Participante | **Lacuna:** Notificação não recebe nenhum evento que indique cota pendente ([#72](../../../../issues/72)) |
| Avisar o valor da cota do ano | Todos | Evento *Valor da cota definido* → Notificação |
| Avisar o início da cobrança do mês | Todos | **Lacuna:** *Cota devida* vai só para Financeiro, não para Notificação ([#72](../../../../issues/72)) |
| Registrar gastos com nota e reembolsar quem pagou | Gestor | [Gasto](../dominio/GLOSSARIO.md#gasto), [Nota](../dominio/GLOSSARIO.md#nota), [Reembolso](../dominio/GLOSSARIO.md#reembolso) |
| Resumo do mês: entrou, saiu e sobrou | Todos | Leitura *Saldo da caixinha*. **Lacuna:** ela dá só o saldo; o total que entrou no mês e o gasto por tipo não existem ([#73](../../../../issues/73)) |
| Pedir complemento quando a caixinha não dá conta | Gestor | [Complemento](../dominio/GLOSSARIO.md#complemento) |
| Embasar o valor da cota do ano | Gestor e participantes | Leitura *Gastos do ano anterior*, hoje só para o gestor |

## Fora do escopo

| Fica de fora | Motivo |
|---|---|
| Controle de consumo ou de acesso à copa | Funciona na confiança; o gestor não quer criar desgaste. |
| Multa, juros ou bloqueio de quem está pendente | O pendente continua usando a copa e acerta depois. |
| Controle de estoque e gasto item por item | Basta o valor total da nota. |
| Lista pública de pendentes | Expõe colegas; contraria o princípio 3. |
| Cobrança automática (débito, link de pagamento) | O pagamento continua por PIX ou dinheiro, recebido pelo gestor. |
| Devolução de dinheiro na saída | Não existe no domínio; o crédito fica guardado para o retorno. |

## Questões em aberto

1. **Lembretes** ([#72](../../../../issues/72)). É a prioridade 1, mas o modelo atual não tem como disparar: Notificação não recebe *Cota devida* nem nada sobre cota pendente. O gestor também nunca pensou em lembretes vindos de outro lugar; só não quer que o pessoal se sinta pressionado. Gatilho, frequência e canal (e-mail, WhatsApp) precisam ser decididos e validados com ele.
2. **Gasto por tipo** ([#73](../../../../issues/73)). O gestor quer mostrar o total gasto por tipo de coisa (café, bolacha, conserto), mas o [Gasto](../dominio/GLOSSARIO.md#gasto) hoje não tem tipo. Exige um termo novo no glossário e mudança no Financeiro.
3. **Pagamento feito por outra pessoa** ([#74](../../../../issues/74)). Às vezes alguém paga pelo outro. Falta definir no domínio a quem o pagamento é atribuído.
4. **Desequilíbrio entre os tipos de cota.** Alguns participantes do tipo de cota só café consomem bolacha e chá. O gestor quer mais equilíbrio, mas não quer controlar consumo. O produto pode, no máximo, deixar claro o que cada tipo de cota inclui.

### Decididas

- **Substituto do gestor.** Não é problema: quando o gestor viaja, outros colegas ajudam informalmente. O FACOFFEE não precisa de um papel de substituto.

## Histórico de revisões

| Versão | Data | Alterações |
|---|---|---|
| 1.0 | 2026-10-25 | Primeira versão, a partir de entrevista com o gestor da copa. |
