# 0031. Avisos do comprovante enviado

- Status: Aceito
- Data: 2026-10-26

## Contexto

Com o [ADR 0030](0030-pagamento-iniciado-pelo-participante.md), o participante envia o comprovante pelo FACOFFEE e o gestor confirma ou recusa. Sem aviso, o gestor só descobre que há comprovante a confirmar quando abre o FACOFFEE, e o participante só descobre a recusa da mesma forma ([issue #88](https://github.com/hsborges/facoffee-app/issues/88)).

Forças em jogo:

- Confirmar já publica *Pagamento recebido*, que Notificação avisa ao participante com o valor ([ADR 0020](0020-envio-de-e-mails-da-notificacao.md)); como o evento leva o valor confirmado, a confirmação já tem aviso.
- Pelo ADR 0030, enviar e recusar não geram evento: Notificação não fica sabendo de nenhum dos dois.
- Notificação não sabe quem é o gestor. Os eventos citam só participantes, e os perfis vêm do token a cada requisição, sem ficar guardados em Usuário ([ADR 0008](0008-dados-do-usuario-logado.md), [ADR 0012](0012-registro-do-usuario-no-primeiro-acesso.md)).
- O gestor é um papel no Keycloak, e quem o tem pode mudar sem o FACOFFEE saber; hoje é uma pessoa só, mas nada impede mais de uma.

## Decisão

Complementa os ADRs 0012 e 0020 e substitui, no ADR 0030, só a regra de que enviar e recusar não geram evento.

**Eventos**: Financeiro publica, pela outbox e na mesma transação que muda o comprovante enviado:

- *Comprovante enviado* (`finance.receipt-sent.v1`), ao enviar: `receiptId`, `participantId` e `amountInCents`, o valor informado.
- *Comprovante recusado* (`finance.receipt-rejected.v1`), ao recusar: os mesmos campos e `reason`, o motivo.

Editar e cancelar continuam sem evento. Os nomes nos contratos (`receipt`, `reason`) entram no [glossário](../dominio/GLOSSARIO.md#nomes-nos-contratos-de-eventos).

**Gestores em Usuário**: o `GET /acesso`, que o gateway chama antes de toda requisição, passa a guardar também os perfis do token (`gestor`, `participante`) na tabela `usuarios`, junto com nome e e-mail, e a atualizá-los quando mudam. Usuário ganha a rota interna `GET /contato/gestor`, que responde `[{ id, nome, email }]` dos usuários com o perfil `gestor` no último acesso e o acesso ativo. Como `GET /contato/{id}`, fica fora do gateway e responde 404 a requisições com `X-User-Id`.

**Avisos em Notificação**, com o envio, a idempotência e as tentativas do ADR 0020:

- *Comprovante enviado*: um e-mail a cada gestor, com o nome de quem enviou, buscado em `GET /contato/{id}`, e o valor. Sem gestor conhecido, o evento é confirmado sem e-mail, com um aviso no log.
- *Comprovante recusado*: um e-mail ao participante, com o valor e o motivo.

Alternativa descartada: o e-mail do gestor numa variável de configuração de Notificação. É menos código, mas copia um dado pessoal fora de Usuário e precisa ser trocado à mão a cada troca de gestor.

## Consequências

Ganhos:

- O gestor sabe do comprovante enviado sem abrir o FACOFFEE, e o participante sabe da recusa e do motivo.
- Quem é gestor continua decidido só no Keycloak; uma troca de gestor não exige mudança no FACOFFEE.
- Nome, e-mail e perfis ficam só em Usuário.

Custos:

- Dois contratos de evento e mais uma coluna e uma rota interna em Usuário.
- Mais uma chamada a Usuário por comprovante enviado.

Riscos:

- Os perfis valem desde o último acesso: quem deixou de ser gestor continua recebendo os avisos até acessar o FACOFFEE de novo, e um gestor novo só passa a recebê-los depois do primeiro acesso como gestor. Logo após esta mudança, nenhum gestor é conhecido até o próximo acesso.
- `GET /contato/gestor` lista contatos sem conferir identidade: depende do bloqueio do gateway e da recusa de `X-User-Id`, como `GET /contato/{id}`.
- Um comprovante enviado sem gestor conhecido fica sem aviso: só aparece no log.
