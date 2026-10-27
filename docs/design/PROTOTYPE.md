# FACOFFEE Prototype

Protótipo navegável das telas do FACOFFEE, feito no Claude Design a partir da [visão de produto](../produto/VISAO.md), do [glossário](../dominio/GLOSSARIO.md), dos [requisitos](../requisitos/README.md) e do [Design System](DESIGN_SYSTEM.md).

- **Protótipo:** [FACOFFEE Design](https://claude.ai/artifact/7ypfHujXYVCwRNjhknVJXb), um canvas do Claude Design, fonte única das telas. Abre só para quem recebeu acesso pelo menu de compartilhar do artefato.
- **Status:** implementado no `web/`, menos o que pede dado que a API ainda não tem (abaixo). O canvas acompanha o `web/`: mudança de tela atualiza o canvas no mesmo PR ([AGENTS.md](../../AGENTS.md#protótipo)).

## O que tem

Uma fileira do canvas por grupo de telas:

| Fileira | Telas |
| :--- | :--- |
| Fundamentos e entrada | Cores, tipografia, situação, ações, campos e ícones; página inicial antes do login |
| Visão do participante | Entrar na copa, Minha situação, Enviar comprovante, Caixinha, Menu da conta, Confirmação de ação crítica e Desativar meu acesso, no celular |
| Visão do gestor | Escolher a visão, Participantes, Conferir comprovante, Receber pagamento, Gastos e Valor da cota, no celular |
| Desktop · visão do participante | Entrar na copa, Minha situação, Enviar comprovante, Caixinha e Desativar meu acesso a partir de `48rem`, com menu lateral |
| Desktop · visão do gestor | Escolher a visão, Participantes, Conferir comprovante, Receber pagamento, Gastos e Valor da cota a partir de `48rem`, com tabelas |

No modo Play, os botões e menus levam de uma tela à outra.

## O que muda em relação ao que já estava decidido

| No protótipo | Onde ficou decidido |
| :--- | :--- |
| Menu inferior no celular e lateral no desktop; tarefas longas em subpáginas | [ADR 0034](../adr/0034-menu-inferior-no-celular-e-lateral-no-computador.md), que substitui a posição dos menus do [ADR 0029](../adr/0029-visoes-do-gestor-e-do-participante.md) |
| Cores Mocha texto (`#675F55`) e Espuma (`#F1E6D8`), selos de situação | [Design System](DESIGN_SYSTEM.md) |
| Valores rápidos ao enviar comprovante (1 mês, até dezembro, semestre) | RN-FIN-34 |
| Como a situação fica depois de enviar ou receber | RN-FIN-35 |
| Lista "Confira no comprovante", que libera *Confirmar*, e motivos comuns de recusa | RN-FIN-36 |
| Saldo da caixinha, e depois dos reembolsos, na tela Gastos | RN-FIN-37 |
| *Registrar um gasto que paguei* na Caixinha do participante | RN-FIN-26, que já valia pela API |
| Confirmação antes de toda ação crítica | RNF-12 |
| *Desativar meu acesso* numa página própria, pelo menu da conta, só na visão do participante | RN-USU-01 |

## O que ficou de fora

Pede dado que a API ainda não devolve; entra quando a API devolver:

- Simulação do valor da cota do ano seguinte com os participantes de hoje: falta quantos participam com cada tipo de cota.
- Tipo de cota e detalhe de cada participante em Participantes ("cobre até março", "setembro e outubro"), e as cotas do participante em Receber pagamento: o gestor só lê o total do crédito e da pendência.
- "O que está devido" em Minha situação: a API não diz quais cotas já estão quitadas; a tela mostra todas as cotas e complementos.
- Valores da cota na página inicial: só quem está logado lê os valores.
- *Ver os gastos e as notas* na Caixinha: só o gestor lista os gastos.
- Contagens na escolha da visão (comprovantes a confirmar, situação) e "Todos são avisados por e-mail" ao definir o valor da cota (RN-NOT-01 ainda não envia esse aviso).
