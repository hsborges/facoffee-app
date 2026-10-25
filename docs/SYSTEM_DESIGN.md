# FACOFFEE - Design System & Identidade Visual

Este documento descreve os padrões visuais, paleta de cores, tipografia e componentes da aplicação **FACOFFEE**.

![Logo FACOFFEE](./logo.svg)

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
| **Muted Mocha** | `#7A7267` | Subtítulos, descrições, *placeholders* e textos de apoio. |
| **Light Sand** | `#E8E0D5` | Linhas de separação e contornos de *inputs*. |

### Cores Semânticas (Feedback)
* **Sucesso (Verde Folha):** `#3B7A57`
* **Alerta (Caramelo/Âmbar):** `#D9822B`
* **Erro (Vermelho Cereja):** `#C93B2B`

---

## 3. Tipografia

* **Fonte de Destaque (Headings / Títulos):** `Montserrat`, `Plus Jakarta Sans` ou `Poppins`
  * *Pesos:* Bold (700) e Black (900)
* **Fonte de Corpo (Body / UI):** `Inter` ou `DM Sans`
  * *Pesos:* Regular (400), Medium (500) e SemiBold (600)

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

### Elevação e Sombras
* **Sombra Suave (Quente):** `0 8px 24px -4px rgba(65, 60, 49, 0.08)`

### Iconografia
* Ícones com traços arredondados (`stroke-linecap: round`) e espessura média (`2px`).