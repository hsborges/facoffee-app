# 0022. HTTP no ambiente local

- Status: Aceito
- Data: 2026-10-25

## Contexto

O [ADR 0007](0007-api-gateway.md) abriu no gateway só a entrada `:443`, com o certificado autoassinado padrão do Traefik no ambiente local. O navegador avisa sobre o certificado a cada ambiente novo, e ferramentas como `curl` precisam de `-k`.

Forças em jogo:

- O `http://localhost` é um contexto seguro para o navegador: o login com PKCE (Web Crypto) funciona sem TLS.
- O Keycloak local já é servido em HTTP (`http://localhost:8080`).
- O certificado de produção ainda não está configurado ([ADR 0007](0007-api-gateway.md)).

## Decisão

- O gateway ganha a entrada `:80`, em HTTP, publicada pelo docker compose ao lado da `:443`. As rotas, sem `entryPoints`, respondem nas duas entradas, com os mesmos middlewares.
- O client `facoffee-web` aceita também o redirect, a origem e o pós-logout `http://localhost/*`.
- Isso altera só o item **HTTPS** do [ADR 0007](0007-api-gateway.md); o restante continua valendo.

## Consequências

Ganhos:

- `http://localhost` abre o FACOFFEE sem aviso de certificado; `curl` dispensa o `-k`.

Custos:

- Num ambiente que já existia, o Keycloak precisa ser recriado para reimportar o realm com o novo redirect (`docker compose up -d --force-recreate keycloak`).

Riscos:

- Token e dados trafegam sem criptografia na `:80`. Antes da produção, junto do certificado, a entrada `:80` deve só redirecionar para HTTPS.
