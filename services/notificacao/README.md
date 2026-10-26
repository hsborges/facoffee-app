# Notificação

Serviço de suporte. Avisos aos participantes por e-mail (Gmail) e WhatsApp.

- **Consome:** Valor da cota definido, Pagamento recebido, Complemento solicitado, Reembolso feito

Banco e consumidor vêm do [template de serviço](../../templates/service/); sem outbox, porque não publica eventos. Decisão em [ADR 0020](../../docs/adr/0020-envio-de-e-mails-da-notificacao.md).

## Avisos por e-mail

Fila `notification.events`. Para cada evento com payload válido, Notificação busca o contato de cada participante em Usuário (`GET /contato/<id>`, rota interna) e grava os e-mails na tabela `emails`, na mesma transação que registra o evento em `processed_events`: um evento repetido não gera e-mail de novo. Os textos estão em `src/domain/aviso.ts`.

| Evento | Quem recebe |
|---|---|
| *Valor da cota definido* (`participation.contribution-amount-set.v1`) | Ninguém, por ora: o evento não cita participante e Notificação não sabe quem participa |
| *Pagamento recebido* (`finance.payment-received.v1`) | O participante cujas cotas o pagamento quita |
| *Complemento solicitado* (`finance.top-up-requested.v1`) | Cada participante da divisão, com a sua parte |
| *Reembolso feito* (`finance.reimbursement-made.v1`) | Quem pagou o gasto do próprio bolso |

Participante sem contato fica sem e-mail, com um aviso no log. Payload inválido ou Usuário fora do ar: o evento é tentado de novo e vai para a fila de mensagens mortas, como no template.

Um processo à parte envia os e-mails devidos a cada segundo. Falha no envio não perde o e-mail: ele é tentado de novo 1 minuto depois, com espera dobrando até 1 hora, até o servidor SMTP aceitar. Só o destinatário recusado de vez (5xx no `RCPT TO`) para de ser tentado: o e-mail fica na tabela com `recusado_em` e um erro no log.

## Configuração

| Variável | Exemplo |
|---|---|
| `SERVICE` | `notification` (nome do contexto nos contratos) |
| `PORT` | `3000` (padrão; só `GET /health`) |
| `DATABASE_URL` | `postgres://notificacao:notificacao@localhost:5432/notificacao` |
| `RABBITMQ_URL` | `amqp://facoffee:facoffee@localhost:5672` |
| `USUARIO_URL` | `http://usuario:3000` |
| `SMTP_URL` | `smtp://localhost:1025` (Mailpit); no Gmail, `smtps://<conta>:<senha-de-app>@smtp.gmail.com:465` |
| `SMTP_FROM` | `FACOFFEE <facoffee@localhost>` |

## Comandos

```sh
pnpm --filter @facoffee/notificacao test               # unidade
pnpm --filter @facoffee/notificacao test:integration   # precisa de postgres, rabbitmq e mailpit do compose
pnpm --filter @facoffee/notificacao db:generate        # gera migration após mudar src/infra/db/schema.ts
cd infra && docker compose up -d --wait --build notificacao   # e-mails em http://localhost:8025
```
