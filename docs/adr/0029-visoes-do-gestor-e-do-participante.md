# 0029. Visões do gestor e do participante

- Status: Aceito; posição dos menus substituída por 0034; páginas da visão do gestor e endereço substituídos por 0037
- Data: 2026-10-26

## Contexto

Pelo [ADR 0019](0019-base-do-front-end.md), *Navegação*, o gestor vê um menu só, com as páginas do participante e as dele. O gestor também é participante ([GLOSSARIO.md](../dominio/GLOSSARIO.md#gestor)), mas as tarefas são diferentes: como gestor, cuida da copa de todos; como participante, confere a própria situação. Juntas, deixam o menu longo, principalmente no celular ([ADR 0028](0028-mobile-first.md)).

## Decisão

Substitui, no ADR 0019, só a *Navegação*; o resto continua valendo.

- **Duas visões**, cada uma com o seu menu: a do **participante** (*Minha situação* e *Caixinha*) e a do **gestor** (*Participantes*, *Gastos* e *Valor da cota*). *Solicitar complemento* sai da *Caixinha* e vai para *Gastos*.
- **Escolha**: ao entrar, o gestor escolhe a visão antes de qualquer página. Quem não é gestor não vê a escolha e fica sempre na visão do participante, onde quem ainda não participa pede entrada.
- **Menu da conta**: o avatar, com as iniciais, no canto do topo, abre um popover nativo (`popover`, que fecha com Esc e com clique fora) com o nome, a troca de visão e *Sair*. O menu principal fica só com as páginas.
- **Troca**: para o gestor, o menu da conta tem, nas duas visões, um link para a outra, a qualquer momento e sem sair.
- **Endereço**: cada página é de uma visão só, e é ela que define a visão mostrada. Página da outra visão, aberta pelo endereço, leva o gestor a ela; para quem não é gestor, responde "Página não encontrada".
- **Memória**: a escolha fica no `sessionStorage` e vale até fechar a aba; um novo login escolhe de novo.

A API continua conferindo o perfil em cada rota.

## Consequências

Ganhos:

- Menus curtos, com só as páginas da tarefa do momento.
- Quem não é gestor não percebe mudança.
- A troca é um link: funciona por teclado e no celular sem código próprio.

Custos:

- O gestor tem um passo a mais a cada login.
- Para conferir o saldo da caixinha antes de solicitar complemento, o gestor troca para a visão do participante.
