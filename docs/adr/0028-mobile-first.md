# 0028. Mobile first

- Status: Aceito
- Data: 2026-10-26

## Contexto

O FACOFFEE é usado principalmente pelo celular: gestor e participantes já resolvem a copa pelo WhatsApp e só às vezes usam o computador ([VISAO.md](../produto/VISAO.md#pessoas)). O web ([ADR 0019](0019-base-do-front-end.md)) tem layout fluido, mas foi desenhado a partir do computador: as tabelas largas, como as de *Participantes* e *Gastos*, transbordam numa tela estreita.

Forças em jogo:

- O WCAG 2.2 AA pede conteúdo sem rolagem nas duas direções a 320 px de largura (1.4.10), texto ampliável até 200% (1.4.4) e alvos de toque de pelo menos 24 × 24 px (2.5.8).
- Tabela de dados é a forma acessível de mostrar linhas e colunas, mas uma tabela de seis colunas não cabe em 320 px.
- A tela de login é a do Keycloak, com o tema `facoffee` só em CSS ([ADR 0014](0014-tema-da-tela-de-login.md)).

## Decisão

**Mobile first** é o princípio do front-end: cada tela é projetada primeiro para o celular e depois adaptada a telas maiores.

- **CSS**: o estilo base é o do celular; telas a partir de `48rem` (768 px) ganham ajustes com `@media (min-width: 48rem)`. Um só ponto de quebra enquanto as telas não pedirem outro.
- **Largura mínima**: 320 px, sem rolagem horizontal da página.
- **Alvos de toque**: pelo menos 24 × 24 px.
- **Tabelas**: com até três colunas, continuam tabela em qualquer largura; com mais, no celular cada linha vira um bloco e cada célula mostra o rótulo da coluna. A marcação continua `<table>`: só o CSS muda.
- **Login**: o tema `facoffee` segue as mesmas regras.
- **Teste**: o teste ponta a ponta ([ADR 0023](0023-teste-ponta-a-ponta-com-playwright.md)) roda no computador e num celular de 320 px, e confere que nenhuma tela rola na horizontal.

As regras de cada componente ficam no [Design System](../design/DESIGN_SYSTEM.md#5-mobile-first).

## Consequências

Ganhos:

- As telas funcionam no aparelho que as pessoas mais usam, e o WCAG de reflow e de alvo de toque fica coberto.
- Uma regra única para tabelas largas, sem biblioteca nem marcação duplicada.

Custos:

- O teste ponta a ponta roda duas vezes, uma por largura: cerca do dobro do tempo dos testes, fora o build.
- Cada célula de tabela larga repete o rótulo da coluna em `data-rotulo`.

Riscos:

- Navegadores antigos que não aceitam texto alternativo vazio em `content` (`/ ""`) leem o rótulo da coluna duas vezes.
- Mudar o `display` de tabela já tirou a semântica dela em alguns navegadores; os atuais a mantêm, mas uma regressão afeta o leitor de tela no celular.
