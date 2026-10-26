# 0024. CI no GitHub Actions

- Status: Aceito
- Data: 2026-10-25

## Contexto

O merge em `main` exige CI verde ([AGENTS.md](../../AGENTS.md)), mas não havia CI. O repositório é um monorepo pnpm com vários workspaces; rodar tudo em cada PR fica mais lento à medida que os serviços crescem. Os contratos de eventos são lidos por mais de um contexto e precisam ser conferidos em todo PR.

## Decisão

- CI no GitHub Actions, em `.github/workflows/ci.yml`, a cada PR para `main`. O job `ci` é a verificação obrigatória da proteção de `main`.
- Permissão mínima (`contents: read`) e uma execução por branch: um novo push cancela a anterior ainda em andamento.
- Sempre: `pnpm lint` (do repositório inteiro), os testes dos contratos de eventos (`@facoffee/contracts`, que validam schemas, exemplos, `asyncapi.json` e glossário) e os testes dos scripts da raiz.
- Testes e build só dos workspaces afetados: os mudados desde `main` e os que dependem deles (`pnpm --filter "...[origin/main]"`). Se mudar a configuração da raiz (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`), todos os workspaces.
- Fora do CI: os testes de integração (`test:integration`), que precisam da stack local; o teste ponta a ponta ([ADR 0023](0023-teste-ponta-a-ponta-com-playwright.md)); e o build das imagens Docker.

## Consequências

Ganhos:

- PR que muda um serviço só testa e compila aquele serviço.
- Contratos e lint conferidos em todo PR.

Custos:

- O checkout busca o histórico inteiro (`fetch-depth: 0`) para comparar com `main`.

Riscos:

- Um arquivo da raiz fora da lista acima que afete os workspaces (ex.: um novo arquivo de configuração compartilhado) não dispara todos: a lista precisa acompanhá-lo.
- Integração, imagens Docker e fluxo ponta a ponta só são conferidos na máquina.
