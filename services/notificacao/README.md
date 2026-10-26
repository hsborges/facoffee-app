# Notificação

Serviço de suporte. Avisos aos participantes por e-mail (Gmail) e WhatsApp.

- **Consome:** Valor da cota definido, Pagamento recebido, Complemento solicitado, Reembolso feito

Banco e consumidor vêm do [template de serviço](../../templates/service/); sem outbox, porque não publica eventos. Decisões em [ADR 0020](../../docs/adr/0020-envio-de-e-mails-da-notificacao.md) e [ADR 0027](../../docs/adr/0027-lembrete-aos-pendentes.md).

## Avisos por e-mail

Fila `notification.events`. Para cada evento com payload válido, Notificação busca o contato de cada participante em Usuário (`GET /contato/<id>`, rota interna) e grava os e-mails na tabela `emails`, na mesma transação que registra o evento em `processed_events`: um evento repetido não gera e-mail de novo. Os textos estão em `src/domain/aviso.ts`.

| Evento | Quem recebe |
|---|---|
| *Valor da cota definido* (`participation.contribution-amount-set.v1`) | Ninguém, por ora: o evento não cita participante e Notificação não sabe quem participa |
| *Pagamento recebido* (`finance.payment-received.v1`) | O participante cujas cotas o pagamento quita |
| *Complemento solicitado* (`finance.top-up-requested.v1`) | Cada participante da divisão, com a sua parte |
| *Reembolso feito* (`finance.reimbursement-made.v1`) | Quem pagou o gasto do próprio bolso |

Participante sem contato fica sem e-mail, com um aviso no log. Payload inválido ou Usuário fora do ar: o evento é tentado de novo e vai para a fila de mensagens mortas, como no template.

## Cota devida e lembretes aos pendentes

`POST /lembrar-pendentes`, rota interna disparada pelo agendador a cada hora; o gateway não roteia Notificação. Consulta os participantes ativos pendentes em Financeiro (`GET /pendente`, rota interna) e, no horário de Campo Grande:

| E-mail | Quem recebe |
|---|---|
| *Cota de \<mês\>* | O pendente cuja cota mais recente, em Financeiro, é a do mês atual. Quem tem a cota abatida do crédito não está pendente e não recebe. |
| *Lembrete da copa* | A partir do dia 10, cada pendente, uma vez no mês. Quem recebe o aviso da cota devida do dia 10 em diante não recebe outro. |

Cada e-mail cita só a pendência do próprio participante. A tabela `lembretes` tem chave única (participante, mês, tipo): disparos repetidos ou simultâneos não duplicam e-mail. Responde `{ lembretes }`, quantos foram registrados agora. Financeiro ou Usuário fora do ar: 500, e o agendador tenta de novo na hora seguinte. Nada sai antes das 8h (`HORA_DOS_LEMBRETES`). O dia do lembrete é `DIA_DO_LEMBRETE`, em `src/domain/lembrete.ts`.

## Envio

Um processo à parte envia os e-mails devidos a cada segundo. Falha no envio não perde o e-mail: ele é tentado de novo 1 minuto depois, com espera dobrando até 1 hora, até o servidor SMTP aceitar. Só o destinatário recusado de vez (5xx no `RCPT TO`) para de ser tentado: o e-mail fica na tabela com `recusado_em` e um erro no log.

## Configuração

| Variável | Exemplo |
|---|---|
| `SERVICE` | `notification` (nome do contexto nos contratos) |
| `PORT` | `3000` (padrão; `GET /health` e `POST /lembrar-pendentes`) |
| `DATABASE_URL` | `postgres://notificacao:notificacao@localhost:5432/notificacao` |
| `RABBITMQ_URL` | `amqp://facoffee:facoffee@localhost:5672` |
| `USUARIO_URL` | `http://usuario:3000` |
| `FINANCEIRO_URL` | `http://financeiro:3000` |
| `SMTP_URL` | `smtp://localhost:1025` (Mailpit); no Gmail, `smtps://<conta>:<senha-de-app>@smtp.gmail.com:465` |
| `SMTP_FROM` | `FACOFFEE <facoffee@localhost>` |
| `HORA_DOS_LEMBRETES` | `8` (padrão; hora de Campo Grande, de 0 a 23, a partir da qual saem o aviso da cota devida e o lembrete; o teste e2e usa `0`) |

## Comandos

```sh
pnpm --filter @facoffee/notificacao test               # unidade
pnpm --filter @facoffee/notificacao test:integration   # precisa de postgres, rabbitmq e mailpit do compose
pnpm --filter @facoffee/notificacao db:generate        # gera migration após mudar src/infra/db/schema.ts
cd infra && docker compose up -d --wait --build notificacao   # e-mails em http://localhost:8025
```
