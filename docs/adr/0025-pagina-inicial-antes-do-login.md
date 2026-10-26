# 0025. Página inicial antes do login

- Status: Aceito
- Data: 2026-10-26

## Contexto

Pelo [ADR 0019](0019-base-do-front-end.md), quem abre o FACOFFEE web sem estar logado vai direto ao Keycloak, sem saber onde está. Depois de sair, a pessoa volta à raiz e é levada de novo ao login. O público é pequeno e conhecido ([VISAO.md](../produto/VISAO.md#pessoas)): basta identificar o sistema e levar ao login.

## Decisão

Substitui, no ADR 0019, só a entrada de quem não está logado; o resto continua valendo.

Quem não está logado vê a página inicial, no layout de aviso: logo, uma frase do que é o FACOFFEE e o botão **Entrar**. O login só começa no botão. A página pedida continua no `state` do OIDC e é aberta depois do login. Quem já está logado não vê a página inicial.

## Consequências

Ganhos:

- O visitante sabe onde está antes do login.
- Sair mostra a página inicial, em vez de abrir o login de novo.

Custos:

- Um clique a mais para entrar.
