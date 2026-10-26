# 0014. Tema da tela de login

- Status: Aceito
- Data: 2026-10-25

## Contexto

A tela de login é a do Keycloak, com a identidade visual dele, não a do [Design System](../design/DESIGN_SYSTEM.md). Quem entra no FACOFFEE vê primeiro uma tela que não parece do FACOFFEE.

Forças em jogo:

- Em produção, o login é o Passaporte UFMS, um Keycloak da universidade compartilhado com outros sistemas ([ADR 0011](0011-acesso-desativado.md)): o FACOFFEE não instala tema nele.
- Fontes de terceiros (ex.: Google Fonts) numa tela de login enviam o IP de cada acesso para fora.
- O Design System pede contorno de input em Light Sand (`#E8E0D5`), com contraste de cerca de 1,3:1 sobre branco; o WCAG 1.4.11 pede 3:1 para contornos de campos.

## Decisão

**Tema `facoffee`** em `infra/keycloak/themes/facoffee/`, só de login, montado em `/opt/keycloak/themes` e definido como `loginTheme` do realm local. Estende o `keycloak.v2` e muda só CSS e imagem, sem sobrescrever templates `.ftl`: as variáveis do PatternFly recebem os tokens do Design System.

**Fontes locais**: Inter e Montserrat (OFL, subconjunto latin) ficam no tema, com as licenças. O logo tem o texto em contornos, pois imagem de fundo não carrega fontes.

**Contorno de input em Muted Mocha** (`#7A7267`, 4,7:1), desvio do Design System pela acessibilidade. Modo escuro desligado, pois o Design System só define o claro.

## Consequências

Ganhos:

- A tela de login local segue o Design System, sem chamar terceiros.
- Atualizar o Keycloak raramente quebra o tema, pois nenhum template é copiado.

Custos:

- Em produção, a tela continua a do Passaporte UFMS, a menos que a universidade instale o tema.
- Cerca de 90 KB de fontes versionados; o logo do tema é uma cópia de `docs/design/facoffee-logo.svg` e precisa acompanhar mudanças nele.

Riscos:

- Uma versão nova do `keycloak.v2` pode renomear classes ou variáveis do PatternFly e desfazer parte do estilo sem erro.
