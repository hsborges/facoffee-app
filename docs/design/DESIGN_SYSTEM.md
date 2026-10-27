# FACOFFEE - Design System & Identidade Visual

Este documento descreve os padrões visuais, paleta de cores, tipografia e componentes da aplicação **FACOFFEE**.

![Logo FACOFFEE](./facoffee-logo.svg)

---

## 1. Visão Geral da Marca

A estética da **FACOFFEE** transmite **modernidade, acolhimento, sobriedade e energia** através do contraste entre o marrom café torrado (forte e sólido) e o bege *latte* (suave e cremoso), apoiados por uma tipografia geométrica pesada.

---

## 2. Paleta de Cores (Color Tokens)

### Cores Principais (Brand)
| Nome | Hex | Uso Recomendado |
| :--- | :--- | :--- |
| **Espresso Dark** (Primária) | `#413C31` | Cabeçalhos, textos principais, ícones ativos e botões primários. |
| **Espresso Hover** | `#2E2A22` | Estado de *hover* em botões e elementos primários. |
| **Warm Latte** (Secundária) | `#D5B290` | Botões secundários, *badges*, destaques visuais e bordas ativas. |
| **Warm Latte Hover** | `#C8A079` | Estado de *hover* para elementos secundários. |

### Cores Neutras (Backgrounds & Superfícies)
| Nome | Hex | Uso Recomendado |
| :--- | :--- | :--- |
| **Pure White** | `#FFFFFF` | Fundo principal da aplicação. |
| **Cream Off-White** | `#F9F6F2` | Fundo secundário, cards de produtos, modais e seções. |
| **Muted Mocha** | `#7A7267` | Contornos de *inputs* (4,7:1 sobre branco). Não é texto sobre o creme (4,4:1). |
| **Mocha Texto** | `#675F55` | Subtítulos, descrições, *placeholders* e textos de apoio, sobre o branco, o creme ou a espuma (5,6:1 no creme). |
| **Espuma** | `#F1E6D8` | Fundos de destaque: avisos, a página atual no menu, o selo *Com crédito*. |
| **Light Sand** | `#E8E0D5` | Só linhas de separação. |

### Cores Semânticas (Feedback)
* **Sucesso (Verde Folha):** `#3B7A57`, texto também, sobre o branco ou o fundo `#ECF4EF`.
* **Alerta (Caramelo/Âmbar):** `#D9822B`, só ícones e bordas; como texto, `#8A4A12` sobre o fundo `#FBEBDB`.
* **Erro (Vermelho Cereja):** `#C93B2B`; como texto sobre o fundo `#F8E1DE`, `#A12F22`.

### Situação
Cada situação é um selo em pílula, com ícone e palavra, além da cor (WCAG 1.4.1):

| Selo | Cores | Ícone |
| :--- | :--- | :--- |
| **Em dia**, **Confirmado** | Verde Folha sobre `#ECF4EF` | ✓ |
| **Pendente** | `#8A4A12` sobre `#FBEBDB` | Relógio |
| **Com crédito** | Espresso sobre Espuma | + |
| **A confirmar** | Espresso sobre branco, borda tracejada: ainda não é pagamento (RN-FIN-07) | Relógio |
| **Recusado** | `#A12F22` sobre `#F8E1DE` | × |
| **Saiu** | Mocha Texto sobre Espuma | — |

---

## 3. Tipografia

* **Fonte de Destaque (Headings / Títulos):** `Montserrat`, `Plus Jakarta Sans` ou `Poppins`
  * *Pesos:* Bold (700), ExtraBold (800) e Black (900)
* **Fonte de Corpo (Body / UI):** `Inter` ou `DM Sans`
  * *Pesos:* Regular (400), Medium (500) e SemiBold (600)

| Uso | Fonte | Tamanho |
| :--- | :--- | :--- |
| Valor em destaque (saldo, pendente) | Montserrat 800 | 48 px no computador, 40 px no celular |
| Título de página | Montserrat 700 | 28 px |
| Seção | Montserrat 700 | 18 px |
| Corpo | Inter 400 | 16 px |
| Apoio | Inter 500 | 14 px, o mínimo |

A hierarquia põe a situação de cada um primeiro, em número grande.

---

## 4. Componentes de UI

### Bordas Arredondadas (Border Radius)
* **Botões e Inputs:** `8px` a `12px`
* **Pílulas / Tags:** `9999px`
* **Cards de Produtos / Modais:** `16px`

### Botões (Buttons)
1. **Primário:** Fundo `#413C31`, texto `#FFFFFF`, *hover* `#2E2A22`.
2. **Secundário:** Fundo `#D5B290`, texto `#413C31`, *hover* `#C8A079`.
3. **Outline / Fantasma:** Borda `1.5px solid #413C31`, fundo transparente, texto `#413C31`.
4. **Destrutivo discreto:** link sublinhado em `#A12F22`, sem fundo, para *Sair da copa* e *Desativar meu acesso*.
5. **Destrutivo forte:** fundo `#A12F22`, texto `#FFFFFF`, *hover* `#82251B`; só para confirmar uma ação destrutiva, na Confirmação.

Uma ação primária por tela.

### Confirmação
Ação crítica pede confirmação ([RNF-12](../requisitos/nao-funcionais.md#rnf-12-ação-crítica-pede-confirmação)) num diálogo modal, no centro da tela, sobre um véu Espresso a 50%:

* **Título:** a pergunta, com quem e o quê (*Desativar o acesso de Bia?*); **texto:** o que acontece depois.
* **Botões:** *Voltar*, em Outline, e a ação com o mesmo nome do botão que abriu o diálogo, nunca "OK". Destrutivo forte para o que encerra algo (*Sair da copa*, *Desativar meu acesso*, *Cancelar envio*, *Desativar acesso*); Primário para o resto (*Entrar na copa*, *Reembolsar*, *Solicitar complemento*, *Definir valores*).
* O foco começa em *Voltar*: Enter não confirma por acidente. *Voltar* e Esc fecham sem fazer nada.

### Fundos e Cards
* A página tem fundo Cream Off-White; o conteúdo fica em cards brancos, com a Sombra Suave.
* O valor principal da tela (saldo da caixinha) pode ficar num card Espresso, com rótulos em Warm Latte.
* Avisos e explicações ficam em Espuma, com ícone.

### Navegação
* **Celular:** menu fixo no pé da tela, com ícone e nome; topo com a logo, o selo *Gestor* e o avatar ([ADR 0034](../adr/0034-menu-inferior-no-celular-e-lateral-no-computador.md)).
* **A partir de `48rem`:** menu lateral, com a logo e o selo no alto e o avatar, o nome e o perfil no pé.
* Página atual com fundo Espuma e sublinhado, não só cor.

### Elevação e Sombras
* **Sombra Suave (Quente):** `0 8px 24px -4px rgba(65, 60, 49, 0.08)`

### Iconografia
* Ícones com traços arredondados (`stroke-linecap: round`) e espessura média (`2px`).

---

## 5. Mobile First

Cada tela é projetada primeiro para o celular e depois adaptada a telas maiores ([ADR 0028](../adr/0028-mobile-first.md)).

### Larguras de Referência
| Largura | Uso |
| :--- | :--- |
| **320 px** | Mínima: tudo funciona sem rolagem horizontal da página (WCAG 1.4.10). |
| **360 a 414 px** | Celulares mais comuns: o desenho de partida de cada tela. |
| **768 px (`48rem`)** | Ponto de quebra: a partir dele, `@media (min-width: 48rem)` aplica o layout do computador. |

* No celular, margens de `1rem`; a partir de `48rem`, `2rem`.
* Texto de corpo a partir de `16px` (`1rem`), sem nada abaixo de `14px`; campos com `16px` também evitam o zoom automático do iOS ao focar.
* Sem bloquear o zoom (`maximum-scale`, `user-scalable=no`): a página continua usável com zoom de 200%.

### Área Mínima de Toque
* Todo alvo de toque tem pelo menos **24 × 24 px** (WCAG 2.5.8): links soltos ganham `padding` vertical; *radios* têm `1.5rem`, e o rótulo inteiro também é clicável.
* Botões, campos e itens do menu têm **44 px** de altura, para o polegar.

### Tabelas em Telas Estreitas
* **Até três colunas:** continuam tabela; o texto quebra dentro da célula.
* **Mais de três colunas:** recebem a classe `empilhada`. No celular, cada linha vira um bloco, separado por Light Sand, e cada célula mostra o rótulo da coluna em Muted Mocha, vindo de `data-rotulo` (ex.: *Valor: R$ 20,00*). O cabeçalho fica só para leitores de tela, e o rótulo visível fica escondido deles. A partir de `48rem`, volta a ser tabela.
* A marcação é sempre `<table>`, com `<caption>` ou título e `scope` nos cabeçalhos: só o CSS muda.

### Cards
* Card que encosta nas bordas da tela fica sem cantos arredondados, como o da tela de login abaixo de 500 px.