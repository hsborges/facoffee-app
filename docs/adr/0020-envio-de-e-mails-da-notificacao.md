# 0020. Envio de e-mails da Notificação

- Status: Aceito
- Data: 2026-10-25

## Contexto

Notificação consome *Valor da cota definido*, *Pagamento recebido*, *Complemento solicitado* e *Reembolso feito* e avisa os participantes por e-mail: Gmail em produção ([ADR 0001](0001-arquitetura-servicos.md)), Mailpit no ambiente local ([ADR 0003](0003-ambiente-local-docker-compose.md)) ([issue #26](https://github.com/hsborges/facoffee-app/issues/26)).

Forças em jogo:

- Os eventos identificam as pessoas só pelo `participantId`. Nome e e-mail ficam no contexto Usuário ([ADR 0012](0012-registro-do-usuario-no-primeiro-acesso.md)).
- *Valor da cota definido* não cita nenhum participante.
- Pelo ADR 0001, chamadas síncronas só partem do gateway e do agendador; o resto é por eventos.
- Um evento repetido não pode enviar e-mail duplicado, e uma falha no envio não pode perder o aviso.
- O consumidor do template ([ADR 0005](0005-template-de-servico.md)) tenta o tratador por ~15 s e depois manda o evento para a fila de mensagens mortas; o Gmail pode ficar fora mais tempo que isso.

## Decisão

Complementa o ADR 0001, sem substituí-lo: abre uma exceção à regra de comunicação, como a do agendador.

**Contatos**: Usuário ganha a rota interna `GET /contato/{id}`, sem identidade, que responde id, nome e e-mail de um usuário, ou 404. A rota não lista todos os usuários, para que quem a alcance só obtenha o contato de um id que já conhece. Como os gatilhos do [ADR 0017](0017-gatilhos-de-tempo-do-agendador.md), ela fica fora do gateway (`/api/usuario/contato` e o que vier abaixo respondem 404 de fora). Por garantia, a rota também responde 404 a requisições com `X-User-Id`, que o gateway sempre envia. Notificação valida o payload e só então chama a rota (`USUARIO_URL`), uma vez por participante do evento.

**Destinatários**:

- *Pagamento recebido* e *Reembolso feito*: o participante do evento; *Complemento solicitado*: cada participante, com a sua parte. Vale mesmo com o acesso desativado, porque o fato é dele.
- *Valor da cota definido*: por ora, ninguém. O evento não cita participante e Notificação não sabe quem participa; o evento é consumido e confirmado sem e-mail.
- Participante sem contato (nunca acessou o FACOFFEE): fica sem e-mail, com um aviso no log.

**Envio desacoplado do consumo**: o tratador grava os e-mails na tabela `emails`, na mesma transação que registra o evento em `processed_events`. Assim, um evento repetido não grava e-mail de novo. Um processo à parte envia os e-mails devidos, um por transação (`for update skip locked`). Quando o envio falha, a tentativa é contada e o e-mail volta a ser tentado 1 minuto depois, com espera dobrando até 1 hora, sem limite de tentativas. A exceção é o destinatário recusado de vez pelo servidor (5xx no `RCPT TO`): o e-mail fica na tabela, marcado como recusado, e não é tentado de novo. Senha errada, remetente recusado ou servidor fora do ar continuam sendo tentados, porque passam quando a causa é corrigida. Se Usuário estiver fora, o tratador falha e o evento segue as tentativas e a fila de mensagens mortas do ADR 0005.

**SMTP**: [Nodemailer](https://nodemailer.com/), configurado por `SMTP_URL` e `SMTP_FROM`. Em produção, `smtps://<conta>:<senha-de-app>@smtp.gmail.com:465`; no ambiente local, `smtp://mailpit:1025`. Conexão, saudação e socket têm tempo limite de 15 s a 30 s, para um servidor travado não segurar a transação do e-mail. Os logs de falha trazem só o código do erro SMTP, sem a mensagem, que costuma ter o endereço. As mensagens são em texto puro, com os termos do [glossário](../GLOSSARIO.md).

## Consequências

Ganhos:

- Um evento repetido não duplica e-mail; um e-mail que falhou fica no banco até ser aceito pelo servidor SMTP ou recusado de vez.
- Uma queda do Gmail não trava a fila de eventos: o consumo segue, e só o envio espera.
- Nome e e-mail ficam só em Usuário, sem cópia em Notificação e sem contrato de evento novo.
- Trocar Gmail por outro provedor é só mudar `SMTP_URL`.

Custos:

- Nova dependência síncrona: com Usuário fora, os avisos atrasam e, depois das tentativas, o evento vai para a fila de mensagens mortas, de onde é reprocessado à mão.
- Uma chamada a Usuário por participante do evento; um complemento com dezenas de participantes faz dezenas de chamadas.
- Sem aviso de *Valor da cota definido* até Notificação conhecer os participantes ativos (por exemplo, consumindo *Participante entrou* e *Participante saiu*).
- A tabela `emails` cresce sem limpeza.

Riscos:

- `GET /contato` não confere identidade: depende do bloqueio do gateway e da recusa de `X-User-Id`, e Usuário não pode ser alcançável de fora da rede interna.
- O envio é pelo menos uma vez: se o processo cair entre o servidor SMTP aceitar o e-mail e o commit, ele é enviado de novo.
- Uma configuração errada do SMTP (senha, remetente) é tentada de hora em hora até ser corrigida; só aparece nos logs. O e-mail recusado pelo destinatário só aparece no log e na tabela, sem reenvio automático.
- O Gmail limita os envios por dia e exige senha de app na conta.
