# 0013. Reativação do acesso

- Status: Proposto
- Data: 2026-10-25

## Contexto

O acesso desativado ([ADR 0011](0011-acesso-desativado.md)) só pode ser desfeito mexendo no banco. A pessoa que saiu pode querer voltar, e só o gestor deve decidir isso.

Forças em jogo:

- Reativar o acesso não devolve a participação: para voltar, a pessoa pede a entrada de novo ([Modelos de domínio §2.1](../MODELOS_DOMINIO.md)).
- Só vai para outros contextos o evento que alguém usa (Modelos de domínio, decisões do modelo).

## Decisão

Complementa o ADR 0011, sem substituí-lo.

**Comando**: `POST /api/usuario/<id>/reativacao`. Aceito só se quem pede é gestor; senão, 403, inclusive para a própria pessoa. Remove o id de `usuarios_desativados`, e o ForwardAuth volta a deixar a pessoa passar na requisição seguinte. Reativar um acesso ativo não tem efeito.

**Sem evento**: a reativação não publica evento. Participação não precisa dela, pois a participação só volta quando a pessoa pede a entrada (*Participante entrou*), e nenhum outro contexto guarda quem está desativado. Por isso glossário, modelos de domínio e `contracts/events/` não mudam.

## Consequências

Ganhos:

- O gestor desfaz uma desativação sem tocar no banco.
- Nenhum contrato novo para manter.

Custos:

- Quem desativou o próprio acesso depende do gestor para voltar.
- O instante da desativação se perde na reativação; não há histórico de desativações.

Riscos:

- Se um contexto passar a guardar quem está desativado, ele não saberá da reativação; aí será preciso publicar um evento, com novo contrato.
- Desativar de novo quem foi reativado publica *Usuário desativado* outra vez, como uma nova desativação.
