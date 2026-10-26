# Contribuindo

Práticas completas (TDD, DDD, ADRs, estilo) em [AGENTS.md](AGENTS.md).

## Ambiente

Node.js 24 e pnpm (versão fixada em `package.json`, via Corepack):

```sh
corepack enable pnpm
pnpm install
```

## Comandos (na raiz)

| Comando | O que faz |
|---|---|
| `pnpm lint` | Lint e formatação (Biome) e TSDoc nos exports (`scripts/check-tsdoc.ts`), sem alterar arquivos |
| `pnpm format` | Corrige lint e formatação |
| `pnpm test` | Testes (Vitest) de todos os workspaces |
| `pnpm test:e2e` | Teste ponta a ponta do fluxo de eventos com Playwright ([`e2e/`](e2e/), [ADR 0023](docs/adr/0023-teste-ponta-a-ponta-com-playwright.md)). Sobe uma stack própria com Testcontainers ([`infra/docker-compose.test.yml`](infra/docker-compose.test.yml), em portas aleatórias, ao lado da stack local) e a remove no fim; os logs ficam em `test-results/compose.log`. Precisa do Docker; na primeira vez, `pnpm exec playwright install chromium` |
| `pnpm build` | Build (TypeScript) de todos os workspaces |

Num workspace só: `pnpm --filter @facoffee/financeiro test`.

Workspaces: `services/*`, `templates/*`, `web`, `contracts` e `gateway`, declarados em `pnpm-workspace.yaml`. Cada um tem `tsconfig.json` estendendo `tsconfig.base.json`.

## Fluxo de branch e PR (GitHub flow)

1. Crie uma branch curta a partir de `main`: `feat/32-cadastro-participante`, `fix/41-saldo-negativo`.
2. Abra um Pull Request para `main` vinculado à issue (`Closes #N`).
3. O merge exige revisão e CI verde. `main` é protegida: nada de commit direto.

A CI ([ADR 0024](docs/adr/0024-ci-no-github-actions.md)) roda `pnpm lint`, os testes dos contratos e dos scripts da raiz e, só nos workspaces afetados, testes e build. Integração, ponta a ponta e imagens Docker não rodam na CI: rode `pnpm test:e2e` localmente antes do PR quando mexer no fluxo de eventos.

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
