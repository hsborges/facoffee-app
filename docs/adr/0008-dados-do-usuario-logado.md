# 0008. Dados do usuário logado

- Status: Proposto
- Data: 2026-10-25

## Contexto

O contexto Usuário precisa de um endpoint com os dados do usuário logado: id, nome, e-mail e perfis de acesso (`gestor`, `participante`). Pelo [ADR 0007](0007-api-gateway.md), só o gateway valida o token e repassa aos serviços `X-User-Id` e `X-User-Roles`; nome e e-mail não chegam aos serviços.

Forças em jogo:

- Os serviços não devem lidar com OIDC (ADR 0007).
- Valores de headers HTTP devem ser ASCII, e nomes têm acentos ("João").
- O token traz papéis que não são do FACOFFEE: os padrões do Keycloak e, no Passaporte UFMS, os de outros sistemas.

## Decisão

Complementa o ADR 0007, sem substituí-lo.

- O verificador do gateway repassa também `X-User-Name` (claim `name`) e `X-User-Email` (claim `email`), codificados com `encodeURIComponent`. Claim ausente → header vazio. Os dois entram em `authResponseHeaders` do ForwardAuth, que sobrescreve qualquer valor enviado pelo cliente.
- O serviço Usuário expõe `GET /api/usuario/eu`, que responde `{ id, nome, email, perfis }` a partir desses headers, sem banco. `perfis` mantém só `gestor` e `participante`.
- Os perfis vêm de papéis do realm no Keycloak.
- O serviço começa só com as camadas `domain/` e `api/` do [template](0005-template-de-servico.md); banco, outbox e consumidor entram quando ele publicar *Usuário desativado*.

## Consequências

Ganhos:

- Nenhum serviço consulta o Keycloak nem guarda dados pessoais para saber quem está logado.
- Qualquer serviço pode usar nome e e-mail do usuário logado sem mudança no gateway.

Custos:

- Quem lê `X-User-Name` e `X-User-Email` precisa decodificá-los.
- Nome e e-mail seguem o que está no token: mudança no Passaporte UFMS só aparece no próximo login.

Riscos:

- No Passaporte UFMS, papéis do realm são compartilhados pela universidade; se `gestor` e `participante` precisarem ser papéis do client `facoffee-web`, o verificador terá de ler `resource_access`.
