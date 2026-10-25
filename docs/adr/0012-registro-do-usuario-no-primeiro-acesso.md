# 0012. Registro do usuário no primeiro acesso

- Status: Aceito
- Data: 2026-10-25

## Contexto

O contexto Usuário só conhece quem está logado no momento, pelos headers do gateway ([ADR 0008](0008-dados-do-usuario-logado.md)), e quem teve o acesso desativado ([ADR 0011](0011-acesso-desativado.md)). Sem um registro dos usuários, o gestor não tem como encontrar quem desativar ou reativar.

Forças em jogo:

- O FACOFFEE não consulta o Passaporte UFMS: o Keycloak é da universidade, e nome e e-mail só chegam pelo token.
- A pessoa pode entrar por qualquer rota, de qualquer contexto, não só por `GET /api/usuario/eu`.
- O ADR 0008 tinha como ganho não guardar dados pessoais para saber quem está logado.
- Ter acesso não faz de alguém um participante (glossário, termos a evitar).

## Decisão

Complementa os ADRs 0008 e 0011, sem substituí-los.

**Registro**: o `GET /acesso` do serviço Usuário, chamado pelo ForwardAuth do gateway antes de toda requisição, passa também a registrar o usuário: grava id (`X-User-Id`, o `sub`), nome e e-mail na tabela `usuarios` no primeiro acesso e os atualiza quando mudam no Passaporte UFMS. Quando nada mudou, a linha não é reescrita. Ids que não são UUID não são registrados, como já não eram verificados no ADR 0011.

**Listagem**: `GET /api/usuario`, só para o gestor (403 para os demais), lista id, nome, e-mail e se o acesso está desativado, em ordem de nome.

O registro não publica evento: nenhum outro contexto precisa saber que alguém acessou o FACOFFEE.

## Consequências

Ganhos:

- Quem acessou qualquer parte do FACOFFEE aparece para o gestor, mesmo quem já está desativado.
- Nome e e-mail ficam em dia sem tarefa de sincronização com o Passaporte UFMS.

Custos:

- O serviço Usuário passa a guardar dados pessoais (nome e e-mail).
- Mais uma escrita por requisição no caminho do gateway, ainda que barata quando nada mudou.

Riscos:

- Quem foi desativado antes deste registro só aparece na listagem depois de tentar acessar de novo.
- A listagem não é paginada; se o número de usuários crescer muito, precisará de paginação.
