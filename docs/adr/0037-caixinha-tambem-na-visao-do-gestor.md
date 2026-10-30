# 0037. Caixinha também na visão do gestor

- Status: Aceito
- Data: 2026-10-30

## Contexto

Pelo [ADR 0029](0029-visoes-do-gestor-e-do-participante.md), a visão do gestor tem *Participantes*, *Gastos* e *Valor da cota*, e a *Caixinha* fica só na visão do participante. O ADR já previa um custo: para ver o saldo da caixinha e o que entrou e saiu no ano, o gestor troca de visão. É justamente o gestor quem cuida da caixinha, e ele também é participante ([GLOSSARIO.md](../dominio/GLOSSARIO.md#gestor)).

## Decisão

Substitui, no ADR 0029, as páginas da visão do gestor e a regra do endereço. A escolha da visão, a troca, a memória e o menu da conta continuam valendo.

- A visão do gestor tem *Participantes*, *Gastos*, *Caixinha* e *Valor da cota*. A *Caixinha*, com a subpágina *Registrar gasto*, é a mesma página nas duas visões.
- **Endereço**: a página aberta pelo endereço mantém a visão escolhida quando pertence a ela. Senão, leva o gestor à visão da página. Para quem não é gestor, página só do gestor continua respondendo "Página não encontrada".

## Consequências

- O gestor vê a caixinha sem trocar de visão.
- O menu do gestor passa a ter quatro itens; no celular, cada um fica com um quarto da largura.
- Uma página pode estar nas duas visões, e o endereço sozinho deixa de definir a visão mostrada.
