# 0003. Ambiente local com docker compose

- Status: Aceito; credenciais em `.env` substituídas por 0038
- Data: 2026-10-25

## Contexto

O [ADR 0001](0001-arquitetura-servicos.md) define RabbitMQ, um banco por serviço, Keycloak (Passaporte UFMS), armazenamento de arquivos e envio de e-mail pelo Gmail. O [ADR 0002](0002-stack.md) escolhe SeaweedFS como armazenamento S3 local. Para desenvolver e testar localmente, tudo isso precisa subir com um comando, sem segredos reais.

## Decisão

Um `infra/docker-compose.yml` com healthcheck em todos os serviços:

- **RabbitMQ** com o painel de gestão.
- **PostgreSQL**: uma instância com um banco e um usuário por serviço (`usuario`, `participacao`, `financeiro`). Só o dono conecta no próprio banco (`REVOKE ALL ... FROM PUBLIC`), o que mantém a regra do ADR 0001 de que nenhum serviço acessa o banco de outro.
- **Keycloak** em modo `start-dev`, mesmo protocolo OIDC do Passaporte UFMS. O realm `facoffee` (client `facoffee-web` com Authorization Code + PKCE, papéis `gestor` e `participante`, usuários de teste) fica versionado em `infra/keycloak/` e é importado no startup.
- **SeaweedFS** com o gateway S3, conforme o ADR 0002.
- **Mailpit** como servidor SMTP de teste, no lugar do Gmail.

Portas publicadas só em `127.0.0.1`. Credenciais em `.env` (não versionado), a partir de `infra/.env.example`.

## Consequências

Ganhos:

- `docker compose up -d --wait` sobe o ambiente inteiro e só retorna com tudo saudável.
- Os serviços falam S3 e SMTP genéricos; trocar SeaweedFS ou Mailpit pelo que for usado em produção é só configuração.

- Uma só instância PostgreSQL: menos memória e uma porta. Separar um banco em servidor próprio depois é só configuração de conexão.

Custos:

- Os bancos dividem recursos (conexões, versão, configuração); um serviço pode afetar o desempenho dos outros no ambiente local.

Riscos:

- O SeaweedFS pode divergir do S3 da produção em casos de borda (políticas, IAM); testes de integração devem usar só operações básicas.
