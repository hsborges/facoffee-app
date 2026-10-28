# Requisitos não funcionais

Vêm dos [princípios de produto](../produto/VISAO.md#princípios-de-produto) e dos ADRs. Os que não dão para verificar por teste levam `Verificação: revisão` e apontam para as regras que os garantem.

### RNF-01 Mobile first: nenhuma tela rola na horizontal a 320 px

- Origem: [ADR 0028](../adr/0028-mobile-first.md), [Design System §5](../design/DESIGN_SYSTEM.md#5-mobile-first)

Cada tela é projetada primeiro para o celular; alvos de toque de pelo menos 24 × 24 px; tabelas largas viram blocos no celular.

```gherkin
# language: pt
Cenário: RNF-01 telas num celular de 320 px
  Dado um celular de 320 px de largura
  Quando o gestor e o participante percorrem todas as telas
  Então nenhuma tela rola na horizontal
```

### RNF-02 Contraste mínimo AA entre os tokens de design

- Origem: [Design System](../design/DESIGN_SYSTEM.md), WCAG 2.2 AA (1.4.3)

```gherkin
# language: pt
Cenário: RNF-02 contraste dos pares de cor
  Dado os pares de cor de texto e fundo do Design System
  Então cada par alcança o contraste mínimo do WCAG AA
```

### RNF-03 Meses e anos viram à meia-noite de Campo Grande

- Origem: [ADR 0015](../adr/0015-fuso-horario-do-dominio.md)

Instantes ficam em UTC; só a conversão para mês e ano usa `America/Campo_Grande`, em todo contexto que fala de meses.

```gherkin
# language: pt
Cenário: RNF-03 virada do mês
  Dado que são 22h de 31 de outubro em Campo Grande
  Quando Ana troca de tipo de cota
  Então a troca é de outubro e vale a partir de novembro
```

### RNF-04 Ninguém é exposto

- Origem: [Visão, princípio 3](../produto/VISAO.md#princípios-de-produto)
- Verificação: revisão. Garantida por RN-FIN-19, RN-FIN-20, RN-FIN-32 e RN-NOT-08: cada participante vê só a própria situação, e a lista de pendentes é só do gestor.

### RNF-05 Gatilhos de tempo repetidos não duplicam nada, e uma falha é refeita na hora seguinte

- Origem: [ADR 0017](../adr/0017-gatilhos-de-tempo-do-agendador.md), [ADR 0027](../adr/0027-lembrete-aos-pendentes.md)

O agendador, a cada hora, dispara o início do ano, depois o início do mês e depois o lembrete aos pendentes, e para no primeiro que falha.

```gherkin
# language: pt
Cenário: RNF-05 disparo repetido
  Dado que o início do mês já foi disparado em abril
  Quando o agendador dispara de novo
  Então nenhuma cota, valor da cota ou lembrete é duplicado
```

### RNF-06 Continua um combinado entre colegas

- Origem: [Visão, princípio 1](../produto/VISAO.md#princípios-de-produto)
- Verificação: revisão. Garantida por RN-FIN-17: sem multa nem juros; bloqueio de quem está pendente fica fora do escopo.

### RNF-07 Leve: não dá mais trabalho ao gestor nem ao pessoal do que hoje

- Origem: [Visão, princípio 2](../produto/VISAO.md#princípios-de-produto)
- Verificação: revisão. Acompanhada pelas métricas da visão (horas do gestor por mês).

### RNF-08 Só o gestor registra pagamento

- Origem: [Visão, princípio 4](../produto/VISAO.md#princípios-de-produto)
- Verificação: revisão. Garantida por RN-FIN-01 e RN-FIN-07: nenhum colega declara que outro pagou, e o comprovante enviado só vale quando o gestor confirma.

### RNF-09 Transparência no agregado

- Origem: [Visão, princípio 5](../produto/VISAO.md#princípios-de-produto)
- Verificação: revisão. Garantida por RN-FIN-32, RN-FIN-33 e RN-FIN-23: total que entrou, gastos por tipo e saldo visíveis a todos; notas, só a pedido.

### RNF-10 Lembrar sem pressionar

- Origem: [Visão, princípio 6](../produto/VISAO.md#princípios-de-produto)
- Verificação: revisão. Garantida por RN-NOT-08 e RN-NOT-10: um lembrete por mês, em tom leve, só da própria situação, nunca de madrugada.

### RNF-11 Confiança no consumo: o uso da copa fica fora do FACOFFEE

- Origem: [Visão, princípio 7](../produto/VISAO.md#princípios-de-produto); [Consumo](../dominio/GLOSSARIO.md#consumo) e [Copa](../dominio/GLOSSARIO.md#copa) no glossário
- Verificação: revisão. Ninguém mede nem anota o consumo, e o acesso à copa não é controlado: só quem participa usa a copa, na confiança.

### RNF-12 Ação crítica pede confirmação

- Origem: [Design System, Confirmação](../design/DESIGN_SYSTEM.md#confirmação)

São críticas: entrar na copa (RN-PAR-01), trocar o tipo de cota (RN-PAR-05), sair da copa (RN-PAR-07), desativar o acesso, o próprio ou o de outra pessoa (RN-USU-01), cancelar o envio de um comprovante (RN-FIN-11), reembolsar (RN-FIN-24), solicitar complemento (RN-FIN-27) e definir o valor da cota (RN-PAR-13). A confirmação diz quem e o quê e o que acontece depois; o foco começa em *Voltar*, para Enter não confirmar por acidente.

```gherkin
# language: pt
Cenário: RNF-12 confirmar a ação crítica
  Dado que Ana participa da copa
  Quando Ana pede a saída e confirma
  Então Ana deixa de participar

Cenário: RNF-12 voltar da confirmação
  Dado que Ana participa da copa
  Quando Ana pede a saída e volta, por Voltar ou por Esc
  Então Ana continua participando
```
