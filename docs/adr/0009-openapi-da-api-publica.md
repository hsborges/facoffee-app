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
- O documento declara o esquema de segurança Bearer (access token do Passaporte UFMS) e a resposta 401 do gateway, comuns a todas as rotas.
- Serviço que expõe, muda ou remove uma rota pública atualiza `gateway/openapi.yaml` no mesmo PR.
- Endpoints internos (`/health`, o `/verify` do verificador) ficam fora.
- O documento é exibido no [Swagger UI](https://github.com/swagger-api/swagger-ui) (imagem oficial `swaggerapi/swagger-ui`), num container `docs` sem porta publicada, servido pelo gateway em `/docs`, sem exigir token: o navegador abre a página antes de ter um. Os caminhos de servidor são relativos (`/`), então o "Try it out" chama o próprio gateway, na mesma origem, sem precisar de CORS.

## Consequências

Ganhos:

- Um só lugar para conhecer a API pública, legível por ferramentas e navegável em `https://localhost/docs`.
- Sem dependência nova nem mudança nos serviços; continua só a porta do gateway aberta ([ADR 0007](0007-api-gateway.md)).

Custos:

- O documento é mantido à mão e pode divergir do código; a revisão de PR é a única garantia.
- Um container a mais.
- Para testar uma rota no Swagger UI, é preciso colar um access token obtido fora dele (botão *Authorize*).

Riscos:

- Se a API crescer e a divergência aparecer, vale gerar o documento pelo código (ex.: `@hono/zod-openapi`), em novo ADR.
- `/docs` expõe a descrição da API sem autenticação; ela não tem segredos, mas em produção pode ser preferível não publicá-la.
