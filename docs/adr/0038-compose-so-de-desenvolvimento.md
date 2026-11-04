# 0038. Compose só de desenvolvimento

- Status: Aceito
- Data: 2026-11-04

## Contexto

O [ADR 0003](0003-ambiente-local-docker-compose.md) põe as credenciais do ambiente local num `.env` não versionado, copiado de `infra/.env.example`. Os valores do exemplo nunca mudam e não são segredos: só valem no computador de quem desenvolve. Ainda assim, cada pessoa copia o arquivo antes de subir a stack, o teste ponta a ponta precisa carregá-lo ([ADR 0023](0023-teste-ponta-a-ponta-com-playwright.md)), e cada serviço novo pede uma senha de banco a mais no `.env.example` e no `postgres/init.sh`.

## Decisão

Substitui, no ADR 0003, só a regra das credenciais em `.env`. O restante do ambiente local continua valendo.

- O compose passa a se chamar `infra/docker-compose.dev.yml` e é só para desenvolvimento. Sobe com `docker compose -f docker-compose.dev.yml up -d --wait --build`.
- As credenciais ficam fixas no próprio arquivo, sem `.env` nem `.env.example`. Só as portas do gateway no host são configuráveis (`GATEWAY_HTTP_PORT` e `GATEWAY_HTTPS_PORT`, padrão 80 e 443), para onde essas portas estão ocupadas ou não são permitidas; o Keycloak recebe as mesmas variáveis e aceita o login nessas portas.
- O PostgreSQL aceita conexões sem senha (`POSTGRES_HOST_AUTH_METHOD=trust`). O `postgres/init.sh` continua criando um banco e um usuário por serviço, sem senha, e só o dono conecta no próprio banco.
- O que é publicado não muda: a infra em `127.0.0.1`, e os serviços de negócio só pelo gateway ([ADR 0007](0007-api-gateway.md)).

## Consequências

- A stack sobe sem passo de configuração, e o teste ponta a ponta usa o mesmo arquivo sem `.env`.
- Serviço novo só entra no compose e na lista do `init.sh`.
- O nome `.dev` deixa claro que o arquivo não serve para produção: sem senha no banco, qualquer processo do computador conecta como qualquer usuário. Produção terá a sua própria configuração, com segredos de verdade.
- Todo comando `docker compose` em `infra/` passa a levar `-f docker-compose.dev.yml`.
