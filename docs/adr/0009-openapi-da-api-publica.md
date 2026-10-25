# 0009. OpenAPI da API pública

- Status: Proposto
- Data: 2026-10-25

## Contexto

O front-end e quem integra com o FACOFFEE só alcançam os serviços pelo gateway ([ADR 0007](0007-api-gateway.md)), em `/api/<contexto>/*`. As rotas estavam descritas apenas nos READMEs, sem formato que ferramentas leiam (cliente gerado, mock, visualizador).

Forças em jogo:

- A API pública atravessa contextos: o prefixo e a autenticação são do gateway, as rotas são de cada serviço.
- Os serviços usam Hono sem validação de esquema; gerar OpenAPI pelo código exigiria nova biblioteca e reescrever as rotas.
- Hoje há uma rota pública (`GET /api/usuario/eu`, [ADR 0008](0008-dados-do-usuario-logado.md)).

## Decisão

- A API pública é descrita num único documento OpenAPI 3.1, escrito à mão, em `gateway/openapi.yaml`.
- Os caminhos usam a URL pública (`/api/<contexto>/...`), não a interna do serviço.
- O documento declara a resposta 401 e dois esquemas de segurança, alternativos e comuns a todas as rotas: `login` (OAuth2 authorization code, com as URLs de login do provedor de identidade) e `bearer` (access token colado).
- O documento é público e descreve só o contrato para quem consome a API: rotas, parâmetros, respostas e como autenticar. Não expõe conhecimento, detalhes ou decisões internas: nada de ADRs, links para o repositório, serviços, gateway, Keycloak, mensageria, nomes de claims, algoritmos ou causas internas de erro. A única exceção são as URLs de login do esquema `login`, sem as quais não há como autenticar.
- Serviço que expõe, muda ou remove uma rota pública atualiza `gateway/openapi.yaml` no mesmo PR.
- Endpoints internos (`/health`, o `/verify` do verificador) ficam fora.
- O documento é exibido no [Swagger UI](https://github.com/swagger-api/swagger-ui) (imagem oficial `swaggerapi/swagger-ui`), num container `docs` sem porta publicada, servido pelo gateway em `/docs`, sem exigir token: o navegador abre a página antes de ter um. Os caminhos de servidor são relativos (`/`), então o "Try it out" chama o próprio gateway, na mesma origem, sem precisar de CORS.
- No *Authorize*, o login com usuário e senha usa a tela do provedor de identidade com authorization code + PKCE e o client do web (`facoffee-web`), o mesmo fluxo do front-end: o token tem o `azp` que o gateway exige ([ADR 0007](0007-api-gateway.md)) e o client continua sem password grant. O client id fica na configuração do Swagger UI, não no documento; o client aceita o redirect `https://localhost/docs/oauth2-redirect.html` e a origem `https://localhost`.

## Consequências

Ganhos:

- Um só lugar para conhecer a API pública, legível por ferramentas e navegável em `https://localhost/docs`.
- Sem dependência nova nem mudança nos serviços; continua só a porta do gateway aberta ([ADR 0007](0007-api-gateway.md)).

Custos:

- O documento é mantido à mão e pode divergir do código; a revisão de PR é a única garantia.
- Um container a mais.
- O client do web passa a aceitar também o redirect e a origem do Swagger UI.

Riscos:

- Se a API crescer e a divergência aparecer, vale gerar o documento pelo código (ex.: `@hono/zod-openapi`), em novo ADR.
- `/docs` publica a descrição da API sem autenticação; um detalhe interno descrito no documento fica exposto. A revisão de PR confere que só o contrato está lá.
- As URLs de login no documento são as do Keycloak local; fora do ambiente local, precisam vir do ambiente (ex.: o Passaporte UFMS em produção) antes de publicar `/docs`.
