# FACOFFEE Prototype

Protótipo navegável das telas do FACOFFEE, feito no Claude Design a partir da [visão de produto](../produto/VISAO.md), do [glossário](../dominio/GLOSSARIO.md), dos [requisitos](../requisitos/README.md) e do [Design System](DESIGN_SYSTEM.md).

- **Protótipo:** [FACOFFEE Prototype](https://claude.ai/artifact/7ypfHujXYVCwRNjhknVJXb). Abre só para quem recebeu acesso pelo menu de compartilhar do artefato.
- **Exportação em PDF:** em cinco partes, uma por fileira, na tabela abaixo.
- **Status:** implementado no `web/`, menos o que pede dado que a API ainda não tem (abaixo).

## O que tem

| Fileira | Telas | PDF |
| :--- | :--- | :--- |
| Fundamentos e entrada | Cores, tipografia, situação, ações, campos e ícones; página inicial antes do login | [`PROTOTYPE-1-fundamentos-e-entrada.pdf`](PROTOTYPE-1-fundamentos-e-entrada.pdf) |
| Visão do participante (celular) | Entrar na copa, Minha situação, Enviar comprovante, Caixinha e Menu da conta | [`PROTOTYPE-2-participante-celular.pdf`](PROTOTYPE-2-participante-celular.pdf) |
| Visão do gestor (celular) | Escolher a visão, Participantes, Conferir comprovante, Receber pagamento, Gastos e Valor da cota | [`PROTOTYPE-3-gestor-celular.pdf`](PROTOTYPE-3-gestor-celular.pdf) |
| Desktop, participante | Entrar na copa, Minha situação, Enviar comprovante e Caixinha a partir de `48rem`, com menu lateral | [`PROTOTYPE-4-participante-desktop.pdf`](PROTOTYPE-4-participante-desktop.pdf) |
| Desktop, gestor | Escolher a visão, Participantes, Conferir comprovante, Receber pagamento, Gastos e Valor da cota a partir de `48rem`, com tabelas | [`PROTOTYPE-5-gestor-desktop.pdf`](PROTOTYPE-5-gestor-desktop.pdf) |

No modo Play, os botões e menus levam de uma tela à outra.

## O que muda em relação ao que já está decidido

O protótipo é uma proposta. Antes de implementar, cada item abaixo precisa de ADR ou de mudança nos requisitos, conforme o [AGENTS.md](../../AGENTS.md):

- Menu inferior no celular e menu lateral no desktop, no lugar do menu atual ([ADR 0029](../adr/0029-visoes-do-gestor-e-do-participante.md)).
- Novas cores: Mocha texto (`#675F55`), para texto de apoio sobre o creme, e Espuma (`#F1E6D8`), para fundos de destaque.
- Saldo da caixinha na tela Gastos do gestor.
- Valores rápidos ao enviar comprovante (1 mês, até dezembro, semestre).
- Lista "Confira no comprovante" e motivos comuns de recusa em Conferir comprovante.
- Simulação do valor da cota de 2027 contra os gastos de 2025.
