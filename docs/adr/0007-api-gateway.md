# 0007. API Gateway

- Status: Aceito
- Data: 2026-10-25

## Contexto

O [ADR 0001](0001-arquitetura-servicos.md) põe só o API Gateway na rede pública, roteando via REST para Usuário, Participação e Financeiro. O [ADR 0002](0002-stack.md) escolheu o Traefik, com o token OIDC validado no gateway por middleware (ex.: ForwardAuth), e deixou o detalhe para a issue do gateway.

Forças em jogo:

- O Traefik open source não valida JWT; o middleware nativo de JWT é do Traefik Hub (pago).
- O Passaporte UFMS é um Keycloak compartilhado por outros sistemas da universidade: um token do mesmo emissor pode ter sido emitido para outro client.
- No ambiente local, o navegador recebe tokens de `http://localhost:8080` (o `iss`), mas os containers alcançam o Keycloak em `http://keycloak:8080`.
- Os serviços precisam saber quem fez a requisição e com quais papéis, sem cada um validar o token.

## Decisão

**Roteamento**: Traefik com provider de arquivo (sem acesso ao socket do Docker), configurado em `gateway/traefik/`.

| Rota pública | Serviço |
|---|---|
| `/api/usuario/*` | Usuário |
| `/api/participacao/*` | Participação |
| `/api/financeiro/*` | Financeiro |

O prefixo `/api/<contexto>` é removido antes de encaminhar. O gateway não compõe respostas.

**HTTPS**: só a entrada `:443`, com TLS. No ambiente local, o certificado autoassinado padrão do Traefik.

**Validação do token**: um verificador próprio, `gateway/` (Hono e [`jose`](https://github.com/panva/jose)), chamado pelo middleware ForwardAuth do Traefik antes de cada requisição. Ele exige `Authorization: Bearer <token>` e confere:

- assinatura, pelas chaves públicas (JWKS) do emissor;
- emissor (`iss`) e expiração (`exp`);
- `azp` igual ao client do FACOFFEE, para recusar tokens emitidos a outros sistemas do Passaporte UFMS.

Token ausente ou inválido → 401, e a requisição não chega ao serviço. Token válido → o Traefik encaminha com os headers `X-User-Id` (o `sub`) e `X-User-Roles` (papéis do realm, separados por vírgula), sobrescrevendo qualquer valor enviado pelo cliente.

Emissor, URL do JWKS e client são variáveis de ambiente; a URL do JWKS é separada do emissor para o caso local.

**Redes**: só o gateway publica porta; o verificador e os serviços ficam na rede interna.

## Consequências

Ganhos:

- Os serviços confiam em `X-User-Id` e `X-User-Roles` e não lidam com OIDC.
- O verificador é pequeno, na mesma stack dos serviços e testado com Vitest; não há plugin de terceiros baixado no startup.
- Rotas e middlewares ficam versionados em arquivos, sem labels nos containers nem socket do Docker.

Custos:

- Um container a mais (o verificador) e um salto de rede por requisição.
- Rota de um serviço novo precisa ser adicionada em `gateway/traefik/dynamic.yml`.

Riscos:

- Os serviços confiam nos headers de identidade: nenhum serviço pode ser alcançável sem passar pelo gateway.
- Se o JWKS ficar inacessível, nenhuma requisição passa (falha fechada, 500).
- Certificado de produção (ACME ou certificado da universidade) ainda não está configurado.
- CORS para o front-end não está configurado; uma origem diferente do gateway precisa dele.
