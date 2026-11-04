# Contribuindo

Como desenvolver no FACOFFEE. O que o produto faz está no [README](README.md); as práticas completas (TDD, DDD, ADRs, estilo) em [AGENTS.md](AGENTS.md). Antes de mexer no domínio, leia a [visão de produto](docs/produto/VISAO.md), o [glossário](docs/dominio/GLOSSARIO.md), os [modelos de domínio](docs/dominio/MODELOS.md) e os [requisitos](docs/requisitos/README.md) da funcionalidade.

## Arquitetura

Um serviço por contexto delimitado, cada um com o próprio banco ([ADR 0001](docs/adr/0001-arquitetura-servicos.md), [diagrama](docs/arquitetura/visao-geral-v2.png)). Os contextos se falam só por eventos de domínio no RabbitMQ, publicados por outbox e consumidos de forma idempotente. O API Gateway é o único ponto aberto: valida o token OIDC, roteia `/api/<contexto>/...` para os serviços e serve o web e a documentação da API.

| Pasta | Conteúdo |
|---|---|
| `services/usuario/` | Contexto Usuário: acesso pelo Passaporte UFMS (Keycloak) |
| `services/participacao/` | Contexto Participação: Participante, Tipo de cota, Cota |
| `services/financeiro/` | Contexto Financeiro: Pagamento, Gasto, Caixinha, Complemento |
| `services/notificacao/` | Avisos por e-mail |
| `services/agendador/` | Gatilhos de início do mês e do ano e lembrete aos pendentes |
| `contracts/events/` | Contratos dos eventos de domínio (JSON Schema e AsyncAPI) |
| `templates/service/` | Template de serviço (camadas, outbox, consumidor idempotente) |
| `gateway/` | API Gateway e OpenAPI da API pública |
| `web/` | FACOFFEE web |
| `infra/` | Ambiente local (docker compose, Keycloak, RabbitMQ, bancos, arquivos, e-mail) |
| `e2e/` | Teste ponta a ponta: um spec por funcionalidade, espelhando `docs/requisitos/` |
| `scripts/` | Scripts da raiz (verificação de TSDoc e dos requisitos) |
| `docs/` | Produto, domínio, requisitos, arquitetura, ADRs e design ([índice](docs/README.md)) |

Cada pasta tem um README com rotas, eventos publicados e consumidos e configuração. Todo serviço segue as camadas do [template](templates/service/README.md): `domain/` (funções puras), `application/` (casos de uso), `infra/` (banco, mensageria) e `api/` (rotas HTTP).

## Stack

TypeScript (`strict`, ESM) em Node.js 24, monorepo com pnpm workspaces. Hono, Drizzle e PostgreSQL, RabbitMQ, Traefik no gateway, React com Vite no web, Vitest, Playwright e Biome. Detalhes e motivos no [ADR 0002](docs/adr/0002-stack.md) e nos [demais ADRs](docs/adr/README.md).

## Ambiente

Node.js 24 e pnpm (versão fixada em `package.json`, via Corepack):

```sh
corepack enable pnpm
pnpm install
```

Para rodar o FACOFFEE inteiro, com Docker:

```sh
cd infra
docker compose -f docker-compose.dev.yml up -d --wait --build
```

O web e a API ficam em https://localhost (ou http://localhost), a documentação da API em https://localhost/docs e os e-mails enviados em http://localhost:8025 (Mailpit). Entre com `gestor`/`gestor` ou `participante`/`participante`. Com `docker compose -f docker-compose.dev.yml up --watch`, cada serviço é refeito ao mudar o seu código. Demais endereços, credenciais e o realm do Keycloak no [README da infra](infra/README.md); o web com recarga automática (`pnpm --filter @facoffee/web dev`) no [README do web](web/README.md).

## Comandos (na raiz)

| Comando | O que faz |
|---|---|
| `pnpm lint` | Lint e formatação (Biome), TSDoc nos exports (`scripts/check-tsdoc.ts`) e requisitos rastreados (`scripts/check-requisitos.ts`), sem alterar arquivos. `node scripts/check-requisitos.ts --matriz` gera a matriz de rastreabilidade |
| `pnpm format` | Corrige lint e formatação |
| `pnpm test` | Testes (Vitest) de todos os workspaces |
| `pnpm test:e2e` | Teste ponta a ponta com Playwright ([`e2e/`](e2e/), [ADR 0023](docs/adr/0023-teste-ponta-a-ponta-com-playwright.md)), o teste de aceitação de cada funcionalidade ([ADR 0033](docs/adr/0033-e2e-como-teste-de-aceitacao-da-funcionalidade.md)); uma regra só: `pnpm test:e2e --grep "RN-PAR-02"`. Roda no computador e, nos testes das telas (`@celular`), num celular de 320 px ([ADR 0028](docs/adr/0028-mobile-first.md)). Sobe uma stack própria com Testcontainers ([`infra/docker-compose.test.yml`](infra/docker-compose.test.yml), em portas aleatórias, ao lado da stack local) e a remove no fim; os logs ficam em `test-results/compose.log`. Precisa do Docker; na primeira vez, `pnpm exec playwright install chromium` |
| `pnpm build` | Build (TypeScript) de todos os workspaces |

Num workspace só: `pnpm --filter @facoffee/financeiro test`.

Workspaces: `services/*`, `templates/*`, `web`, `contracts` e `gateway`, declarados em `pnpm-workspace.yaml`. Cada um tem `tsconfig.json` estendendo `tsconfig.base.json`.

## Antes do PR

- **Teste primeiro:** todo `feat` e `fix` tem teste; um `fix` começa pelo teste que reproduz o bug.
- **Requisitos:** regra de negócio nova ou alterada atualiza [`docs/requisitos/`](docs/requisitos/README.md) e o índice no mesmo PR, com ao menos um teste que cita o ID no nome (`it('RN-FIN-07: ...')`) ou a marca `Verificação: revisão` ([ADR 0032](docs/adr/0032-requisitos-rastreaveis-em-bdd.md)); funcionalidade nova vem com o seu spec em `e2e/`, no caminho espelhado ([ADR 0033](docs/adr/0033-e2e-como-teste-de-aceitacao-da-funcionalidade.md)). O `pnpm lint` confere. Cite os IDs em **Requisitos afetados** no PR.
- **TSDoc:** todo export em `src/` tem comentário `/** ... */` ([ADR 0010](docs/adr/0010-tsdoc-obrigatorio-nos-exports.md)); o `pnpm lint` confere.
- **Rotas HTTP:** em português, seguindo o [ADR 0016](docs/adr/0016-nomenclatura-das-rotas-http.md). Rota pública nova ou alterada atualiza [`gateway/openapi.yaml`](gateway/openapi.yaml) ([ADR 0009](docs/adr/0009-openapi-da-api-publica.md)).
- **Eventos:** contratos em [`contracts/events/`](contracts/events/), em inglês, com os nomes da tabela do [glossário](docs/dominio/GLOSSARIO.md#nomes-nos-contratos-de-eventos) ([ADR 0006](docs/adr/0006-contratos-dos-eventos-em-ingles.md)). Mudança incompatível vira nova versão major do contrato.
- **Decisões:** decisão importante (stack, padrão, limites entre contextos, contratos, persistência, segurança) gera um ADR em [`docs/adr/`](docs/adr/README.md) no mesmo PR, com o índice atualizado.
- **Domínio:** termo novo entra primeiro no glossário.

## Fluxo de branch e PR (GitHub flow)

1. Crie uma branch curta a partir de `main`: `feat/32-cadastro-participante`, `fix/41-saldo-negativo`.
2. Abra um Pull Request para `main` vinculado à issue (`Closes #N`).
3. O merge exige revisão e CI verde. `main` é protegida: nada de commit direto.

A CI ([ADR 0024](docs/adr/0024-ci-no-github-actions.md)) roda `pnpm lint`, os testes dos contratos e dos scripts da raiz e, só nos workspaces afetados, testes e build. Integração, ponta a ponta e imagens Docker não rodam na CI: rode `pnpm test:e2e` localmente antes do PR quando mexer no fluxo de eventos ou nas telas do web.

## Conventional Commits

`<tipo>(<escopo opcional>): <descrição>`

- Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`, `style`.
- Escopo: contexto ou pasta (`participacao`, `financeiro`, `gateway`, `web`).
- Descrição no imperativo, minúscula, sem ponto final.
- Mudança incompatível: `feat!:` e/ou rodapé `BREAKING CHANGE:`.

Exemplos:

```text
feat(participacao): registra entrada de participante
fix(financeiro): impede saldo negativo na caixinha
docs(adr): registra stack do back-end
```
