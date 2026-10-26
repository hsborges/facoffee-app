# 0011. Acesso desativado

- Status: Aceito
- Data: 2026-10-25

## Contexto

O acesso de uma pessoa ao FACOFFEE é desativado pelo gestor ou a pedido da própria pessoa; só o gestor desativa o acesso de outra pessoa ([Modelos de domínio §2.1](../dominio/MODELOS.md)). A desativação publica *Usuário desativado* (`user.user-deactivated.v1`), e o usuário desativado não pode mais acessar o FACOFFEE.

Forças em jogo:

- O Passaporte UFMS é o Keycloak da universidade, compartilhado com outros sistemas: o FACOFFEE não pode desativar a conta da pessoa nele, e o token continua válido.
- Pelo [ADR 0007](0007-api-gateway.md), só o gateway barra requisições; os serviços confiam nos headers de identidade e não guardam quem está desativado, exceto o contexto Usuário.
- Pelo [ADR 0008](0008-dados-do-usuario-logado.md), banco e outbox entram no serviço Usuário quando ele publicar *Usuário desativado*.

## Decisão

Complementa os ADRs 0007 e 0008, sem substituí-los.

**Comando**: `POST /api/usuario/<id>/desativacao`. Aceito se quem pede é gestor ou é a própria pessoa (`<id>` igual a `X-User-Id`); senão, 403. Desativar quem já está desativado não publica de novo.

**Persistência**: o serviço Usuário ganha banco, outbox e relay do [template](0005-template-de-servico.md). A tabela `usuarios_desativados` guarda o id e o instante da desativação; o evento entra no outbox na mesma transação. Sem consumidor: o contexto não consome eventos.

**Barreira no gateway**: as rotas do Traefik passam por um segundo ForwardAuth, depois do verificador de token, apontando para `GET /acesso` do serviço Usuário. Ele recebe `X-User-Id` do primeiro e responde 204 se o acesso está ativo ou 403 se foi desativado. O 403 volta ao cliente e a requisição não chega a nenhum serviço.

## Consequências

Ganhos:

- O bloqueio vale para todas as rotas, de todos os contextos, sem que Participação e Financeiro guardem quem está desativado.
- O efeito é imediato, sem esperar o token expirar.
- A conta no Passaporte UFMS não é tocada.

Custos:

- Mais um salto de rede e uma consulta ao banco do Usuário por requisição.
- Os testes locais do gateway passam a depender do serviço Usuário de pé.

Riscos:

- Se o serviço Usuário cair, nenhuma requisição passa (falha fechada).
- Ainda não há reativação: quem foi desativado só volta por intervenção no banco.
