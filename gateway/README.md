# API Gateway

Ponto de entrada HTTPS e, no ambiente local, HTTP (rede pública, [ADR 0022](../docs/adr/0022-http-no-ambiente-local.md)). Roteia via REST para Usuário, Participação e Financeiro e valida o token OIDC. Decisão em [ADR 0007](../docs/adr/0007-api-gateway.md).

| Rota pública | Encaminha para |
|---|---|
| `/api/usuario/*` | `http://usuario:3000/*`, exceto a rota interna `contato` (404, [ADR 0020](../docs/adr/0020-envio-de-e-mails-da-notificacao.md)) |
| `/api/participacao/*` | `http://participacao:3000/*`, exceto os gatilhos internos `iniciar-ano` e `iniciar-mes` (404, [ADR 0017](../docs/adr/0017-gatilhos-de-tempo-do-agendador.md)) |
| `/api/financeiro/*` | `http://financeiro:3000/*` |
| `/docs/*` | `http://docs:8080/docs/*` (Swagger UI, sem token) |
| Qualquer outro caminho fora de `/api` | `http://web:80` (FACOFFEE web, sem token, [ADR 0021](../docs/adr/0021-front-end-servido-pelo-gateway.md)) |

Toda rota `/api/*` exige `Authorization: Bearer <access token do Keycloak>`. Sem token ou com token inválido: 401. Com token válido, o serviço recebe `X-User-Id` (o `sub`), `X-User-Roles` (papéis do realm, separados por vírgula), `X-User-Name` (o `name`) e `X-User-Email` (o `email`); nome e e-mail vêm codificados com `encodeURIComponent` ([ADR 0008](../docs/adr/0008-dados-do-usuario-logado.md)). Header ausente no token vai vazio. Em seguida, o serviço Usuário registra o usuário e confere se o acesso foi desativado: 403 e a requisição para ([ADR 0011](../docs/adr/0011-acesso-desativado.md), [ADR 0012](../docs/adr/0012-registro-do-usuario-no-primeiro-acesso.md)).

Rotas, respostas e autenticação estão em [`openapi.yaml`](openapi.yaml) (OpenAPI 3.1, [ADR 0009](../docs/adr/0009-openapi-da-api-publica.md)), navegável no Swagger UI em https://localhost/docs, sem token; em *Authorize*, `login` entra com usuário e senha do Keycloak. Serviço que expõe ou muda uma rota atualiza esse arquivo no mesmo PR.

| Caminho | Conteúdo |
|---|---|
| `openapi.yaml` | Especificação da API pública |
| `traefik/` | Configuração do Traefik: estática (`traefik.yml`) e rotas e middlewares (`dynamic.yml`) |
| `src/` | Verificador de token chamado pelo ForwardAuth (`GET /verify`) |

## Configuração do verificador

| Variável | Exemplo |
|---|---|
| `OIDC_ISSUER` | `http://localhost:8080/realms/facoffee` (`iss` dos tokens) |
| `OIDC_JWKS_URL` | `http://keycloak:8080/realms/facoffee/protocol/openid-connect/certs` |
| `OIDC_CLIENT_ID` | `facoffee-web` (`azp` exigido) |
| `PORT` | `3000` (padrão) |

## Comandos

```sh
pnpm --filter @facoffee/gateway test
cd infra && docker compose up -d --wait --build gateway
curl -k https://localhost/api/usuario/   # 401
```

Localmente o certificado é o autoassinado do Traefik (`curl -k`).
