# 0027. Lembrete aos pendentes

- Status: Aceito
- Data: 2026-10-26

## Contexto

Cobrar é a dor número 1 do gestor ([Visão de produto](../produto/VISAO.md)): ele lembra cada pendente 2 a 3 vezes, e cobrar colegas é o que mais o desgasta. Ele quer que os lembretes não dependam dele, sem pressionar nem expor ninguém ([issue #72](https://github.com/hsborges/facoffee-app/issues/72)). Hoje Notificação não sabe nada de cota nem de pendência.

Forças em jogo:

- Quem é pendente é a leitura *Crédito e pendentes*, de Financeiro. Ela soma pagamentos, cotas e partes de complementos desde o primeiro dia; Notificação não tem esse histórico e não pode refazer a conta sem arriscar cobrar quem já pagou.
- Lembrar um pendente não muda nada no domínio: o modelo já tirou o evento *Pendente cobrado* ([MODELOS.md](../dominio/MODELOS.md#decisões-do-modelo-enxuto)).
- *Cota devida* chega a Financeiro e a Notificação ao mesmo tempo, pelo broker. Notificação não sabe se o crédito do participante abate a cota, e perguntar a Financeiro logo ao receber o evento corre contra o processamento do mesmo evento lá.
- O agendador já dispara os gatilhos de tempo a cada hora, sem estado, e pode disparar de novo ou em paralelo ([ADR 0017](0017-gatilhos-de-tempo-do-agendador.md)).
- Pelo [ADR 0001](0001-arquitetura-servicos.md), chamadas síncronas partem do gateway e do agendador; o [ADR 0020](0020-envio-de-e-mails-da-notificacao.md) já abriu a exceção Notificação → Usuário para os contatos.

Decidido na issue: o aviso da cota devida vai só a quem não tem a cota abatida do crédito; o lembrete sai uma vez por mês, a partir do dia 10, só para participantes ativos; por e-mail.

## Decisão

Complementa o ADR 0001, o ADR 0017 e o ADR 0020, sem substituí-los. Nenhum evento novo: Notificação não consome *Cota devida*.

**Leitura em Financeiro**: rota interna `GET /pendente`, sem identidade, que responde os participantes ativos pendentes, cada um com o que tem pendente e a sua cota mais recente: `[{ id, pendenteEmCentavos, cota: { mes, tipoDeCota, valorEmCentavos } | null }]`. Quem tem crédito ou está em dia não aparece. Como `GET /contato` no ADR 0020, fica fora do gateway (`/api/financeiro/pendente` e o que vier abaixo respondem 404 de fora) e responde 404 a requisições com `X-User-Id`.

**Gatilho em Notificação**: rota interna `POST /lembrar-pendentes`, sem identidade, que o gateway não roteia. Usa o relógio de Notificação no fuso de Campo Grande ([ADR 0015](0015-fuso-horario-do-dominio.md)), consulta `GET /pendente` (`FINANCEIRO_URL`) e, para cada pendente:

- **Aviso da cota devida**: quando a cota mais recente é do mês atual. Antes de Financeiro registrar a cota do mês, ela ainda é a do mês anterior, e o aviso espera o próximo disparo; assim não há corrida com *Cota devida*.
- **Lembrete**: a partir do dia 10, uma vez no mês. A cota devida avisada do dia 10 em diante (quem entrou no meio do mês) já conta como o lembrete do mês: um e-mail só.

Cada e-mail vai só ao próprio participante e cita só a pendência dele. Responde `{ lembretes }`.

**Idempotência**: a tabela `lembretes` tem chave única (participante, mês, tipo), `tipo` `cota-devida` ou `lembrete`. Os lembretes de um disparo entram numa transação com `on conflict do nothing`, e só o lembrete gravado ali guarda o seu e-mail na tabela `emails`, enviado como os demais (ADR 0020), com o id do lembrete em `evento_id`. Disparos repetidos ou simultâneos não duplicam e-mail.

**Agendador**: depois de `iniciar-ano` e `iniciar-mes` em Participação, chama `lembrar-pendentes` em Notificação (`NOTIFICACAO_URL`). Uma falha para o disparo, e o seguinte refaz tudo.

## Consequências

Ganhos:

- O pendente é lembrado sem ação do gestor, e ninguém vê a pendência de outro.
- Quem tem crédito não recebe aviso nem lembrete; a conta continua só em Financeiro, sem cópia em Notificação.
- Sem contrato de evento novo e sem mudança no modelo de domínio: lembrar continua sem evento.
- Frequência e dia do lembrete ficam em Notificação (`DIA_DO_LEMBRETE`, em `src/domain/lembrete.ts`).

Custos:

- Nova dependência síncrona, Notificação → Financeiro: com Financeiro fora, o disparo falha e é refeito na hora seguinte.
- O aviso da cota devida chega até uma ou duas horas depois da virada do mês: o disparo seguinte ao registro da cota em Financeiro.
- Uma consulta a Financeiro por hora, quase sempre sem e-mail; uma consulta a Usuário por e-mail a enviar.
- Falha em Participação também atrasa o lembrete, porque o agendador para no primeiro gatilho que falha.

Riscos:

- `GET /pendente` lista quem está pendente sem conferir identidade: depende do bloqueio do gateway e da recusa de `X-User-Id`, e Financeiro não pode ser alcançável de fora da rede interna.
- Quem saiu com pendência não é lembrado; continua com o gestor.
- Quem pagou ao gestor e ainda não teve o pagamento recebido no FACOFFEE pode receber o lembrete; o texto pede para desconsiderar se já acertou.
