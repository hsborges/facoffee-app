# 0034. Menu inferior no celular e lateral no computador

- Status: Aceito
- Data: 2026-10-26

## Contexto

Pelo [ADR 0029](0029-visoes-do-gestor-e-do-participante.md), cada visão tem o seu menu no topo, e o avatar, no canto do topo, abre o menu da conta. O [protótipo do redesign](../design/PROTOTYPE.md) põe o menu ao alcance do polegar no celular e numa coluna fixa no computador, e separa as tarefas longas da página que as lista: *Enviar comprovante* sai de *Minha situação*; *Conferir comprovante* e *Receber pagamento* saem de *Participantes*; *Registrar gasto* e *Solicitar complemento* saem de *Gastos*.

## Decisão

Substitui, no ADR 0029, só a posição do menu principal e do menu da conta; as duas visões, a escolha, a troca, o endereço e a memória continuam valendo.

- **Celular**: o menu principal fica fixo no pé da tela, com ícone e nome de cada página; o topo tem a logo, o selo *Gestor* na visão do gestor e o avatar, que abre o menu da conta.
- **Computador** (a partir de `48rem`, [ADR 0028](0028-mobile-first.md)): o menu vira uma coluna à esquerda, com a logo e o selo no alto e, no pé, o avatar com o nome e o perfil, que abre o mesmo menu da conta.
- **Uma marcação só**: o mesmo `<nav>` e o mesmo botão da conta nos dois tamanhos; só o CSS muda.
- **Página atual**: fundo e sublinhado, não só cor (WCAG 1.4.1).
- **Subpáginas**: cada tarefa longa tem endereço próprio sob a página de onde sai (`/enviar-comprovante`, `/participantes/conferir-comprovante`, `/participantes/receber-pagamento`, `/gastos/registrar-gasto`, `/gastos/solicitar-complemento`, `/caixinha/registrar-gasto`), com um link de volta; o menu marca a página de origem. Como as páginas, cada subpágina é de uma visão só.

## Consequências

Ganhos:

- O menu fica ao alcance do polegar no celular, e o computador aproveita a largura.
- Cada tela tem uma ação primária, e as subpáginas podem ser abertas pelo endereço, como as páginas.

Custos:

- O menu fixo no pé ocupa altura do celular: o conteúdo ganha margem embaixo para não ficar escondido.
- Mais rotas para manter na navegação de cada visão.
