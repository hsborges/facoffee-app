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
| `pnpm lint` | Lint e formatação (Biome), sem alterar arquivos |
| `pnpm format` | Corrige lint e formatação |
| `pnpm test` | Testes (Vitest) de todos os workspaces |
| `pnpm build` | Build (TypeScript) de todos os workspaces |

Num workspace só: `pnpm --filter @facoffee/financeiro test`.

Workspaces: `services/*`, `templates/*`, `web` e `contracts`, declarados em `pnpm-workspace.yaml`. Cada um tem `tsconfig.json` estendendo `tsconfig.base.json`.

## Fluxo de branch e PR (GitHub flow)

1. Crie uma branch curta a partir de `main`: `feat/32-cadastro-participante`, `fix/41-saldo-negativo`.
2. Abra um Pull Request para `main` vinculado à issue (`Closes #N`).
3. O merge exige revisão e CI verde. `main` é protegida: nada de commit direto.

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
