# 0019. Envio de e-mails da Notificação

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

**Contatos**: Usuário ganha a rota interna `GET /contato`, sem identidade, que lista id, nome, e-mail e se o acesso está desativado. Como os gatilhos do [ADR 0017](0017-gatilhos-de-tempo-do-agendador.md), ela fica fora do gateway (`/api/usuario/contato` responde 404 de fora). Notificação chama a rota (`USUARIO_URL`) a cada evento.

**Destinatários**:

- *Pagamento recebido* e *Reembolso feito*: o participante do evento; *Complemento solicitado*: cada participante, com a sua parte. Vale mesmo com o acesso desativado, porque o fato é dele.
- *Valor da cota definido*: todo usuário com acesso ativo, porque Notificação não sabe quem participa.
- Participante sem contato (nunca acessou o FACOFFEE): fica sem e-mail, com um aviso no log.

**Envio desacoplado do consumo**: o tratador grava os e-mails na tabela `emails`, na mesma transação que registra o evento em `processed_events`. Assim, um evento repetido não grava e-mail de novo. Um processo à parte envia os e-mails devidos, um por transação (`for update skip locked`). Quando o envio falha, a tentativa é contada e o e-mail volta a ser tentado 1 minuto depois, com espera dobrando até 1 hora, sem limite de tentativas. Se Usuário estiver fora, o tratador falha e o evento segue as tentativas e a fila de mensagens mortas do ADR 0005.

**SMTP**: [Nodemailer](https://nodemailer.com/), configurado por `SMTP_URL` e `SMTP_FROM`. Em produção, `smtps://<conta>:<senha-de-app>@smtp.gmail.com:465`; no ambiente local, `smtp://mailpit:1025`. As mensagens são em texto puro, com os termos do [glossário](../GLOSSARIO.md).

## Consequências

Ganhos:

- Um evento repetido não duplica e-mail; um e-mail que falhou fica no banco até ser aceito pelo servidor SMTP.
- Uma queda do Gmail não trava a fila de eventos: o consumo segue, e só o envio espera.
- Nome e e-mail ficam só em Usuário, sem cópia em Notificação e sem contrato de evento novo.
- Trocar Gmail por outro provedor é só mudar `SMTP_URL`.

Custos:

- Nova dependência síncrona: com Usuário fora, os avisos atrasam e, depois das tentativas, o evento vai para a fila de mensagens mortas, de onde é reprocessado à mão.
- Cada evento busca a lista inteira de contatos.
- A tabela `emails` cresce sem limpeza.

Riscos:

- `GET /contato` não confere identidade: depende só do bloqueio do gateway, e Usuário não pode ser alcançável de fora da rede interna.
- O envio é pelo menos uma vez: se o processo cair entre o servidor SMTP aceitar o e-mail e o commit, ele é enviado de novo.
- Um endereço recusado sempre é tentado de hora em hora, para sempre; só aparece nos logs.
- *Valor da cota definido* também chega a quem tem acesso mas não participa.
- O Gmail limita os envios por dia e exige senha de app na conta.
