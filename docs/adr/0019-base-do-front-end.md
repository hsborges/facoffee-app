# 0019. Base do front-end

- Status: Aceito
- Data: 2026-10-25

## Contexto

O [ADR 0002](0002-stack.md) escolheu React com Vite (SPA) para o FACOFFEE web. Antes das telas do participante e do gestor, o front-end precisa entrar pelo Keycloak, chamar a API pelo gateway, navegar conforme o perfil e seguir o [Design System](../SYSTEM_DESIGN.md).

Forças em jogo:

- O realm local já tem o client público `facoffee-web`, com Authorization Code + PKCE e redirect `http://localhost:5173/*` ([ADR 0003](0003-ambiente-local-docker-compose.md)). Em produção, o emissor é o Passaporte UFMS.
- O gateway não tem CORS ([ADR 0007](0007-api-gateway.md)): uma origem diferente da dele não chama a API.
- Os perfis vêm de papéis do realm, mas só `GET /api/usuario/eu` filtra os do FACOFFEE, registra o usuário no primeiro acesso e responde 403 a quem foi desativado ([ADR 0008](0008-dados-do-usuario-logado.md), [ADR 0011](0011-acesso-desativado.md), [ADR 0012](0012-registro-do-usuario-no-primeiro-acesso.md)).
- Algumas cores do Design System não têm contraste suficiente para texto ou contorno (WCAG 2.2 AA).
- Implementar OIDC à mão (PKCE, troca de código, renovação do token) é fácil de errar.

## Decisão

**Login**: [`oidc-client-ts`](https://github.com/authts/oidc-client-ts) com [`react-oidc-context`](https://github.com/authts/react-oidc-context). Quem não está logado vai direto ao Keycloak; o token fica no `sessionStorage` (padrão da biblioteca) e é renovado sem nova tela de login. O redirect é sempre a raiz (`/`); a página pedida vai no `state` do OIDC e é aberta depois do login, se for um caminho da mesma origem. Emissor e client vêm de `VITE_OIDC_AUTHORITY` e `VITE_OIDC_CLIENT_ID`, com os valores do realm local como padrão. Biblioteca genérica de OIDC, não `keycloak-js`: o front-end não depende de ser Keycloak.

**Chamadas à API**: sempre em `/api/...`, na mesma origem do front-end, com `Authorization: Bearer <access token>`. No desenvolvimento, o servidor do Vite encaminha `/api` ao gateway (`https://localhost`), sem CORS.

**Perfil**: lido de `GET /api/usuario/eu`, não do token. Acesso desativado mostra um aviso com o botão Sair.

**Navegação**: [React Router](https://reactrouter.com) (modo biblioteca). Os itens do menu são as rotas: todos veem as páginas do participante, onde quem ainda não participa pede entrada; o gestor vê também as dele. Página fora do menu do perfil responde "Página não encontrada". A API continua conferindo o perfil.

**Design System**: os tokens são variáveis CSS em `web/src/estilos.css`, sem framework de CSS nem biblioteca de componentes. Fontes e logo (com o texto em contornos) são os arquivos do tema de login ([ADR 0014](0014-tema-da-tela-de-login.md)), importados de `infra/keycloak/themes/facoffee/`, sem cópia.

**Acessibilidade**:

- Contorno de input em Muted Mocha, como no tema de login (ADR 0014).
- Muted Mocha não é texto sobre Cream Off-White (4,4:1); Alerta não é cor de texto nem de contorno (2,9:1).
- `contraste.test.ts` confere os pares de cores usados: 4,5:1 para texto e 3:1 para contornos e foco.
- Teclado: link "Pular para o conteúdo", foco visível em todo elemento e página atual marcada com `aria-current` e sublinhado, não só por cor.

## Consequências

Ganhos:

- Login, renovação e saída sem código próprio de OIDC; trocar o Keycloak local pelo Passaporte UFMS é configuração.
- Sem CORS no gateway enquanto o front-end estiver na mesma origem.
- Os tokens ficam num só arquivo e o contraste deles é testado.

Custos:

- Duas dependências de OIDC e uma de rotas.
- Sem `@vitejs/plugin-react`: uma mudança recarrega a página inteira no desenvolvimento, sem Fast Refresh.
- O build do web depende dos arquivos do tema de login em `infra/`.

Riscos:

- Em produção, o front-end precisa ser servido na mesma origem do gateway (por exemplo, uma rota do Traefik para os arquivos do build); isso ainda não está configurado.
- O token no `sessionStorage` fica exposto a um eventual XSS na página.
- O Passaporte UFMS precisa aceitar o redirect do FACOFFEE web no client.
