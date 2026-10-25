# AGENTS.md

Práticas de engenharia do FACOFFEE. Valem para pessoas e agentes de IA.

## Fluxo de trabalho — GitHub flow

- `main` está sempre estável e pronta para deploy.
- Todo trabalho parte de uma branch curta criada a partir de `main` (ex.: `feat/32-cadastro-participante`, `fix/41-saldo-negativo`).
- Toda mudança entra via Pull Request vinculado à issue (`Closes #N`), com CI verde e revisão.
- Nunca faça commit direto em `main`.

## Commits — Conventional Commits

Formato: `<tipo>(<escopo opcional>): <descrição>`.

- Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`, `style`.
- Escopo: o contexto ou pasta afetada (ex.: `participacao`, `financeiro`, `gateway`, `web`).
- Mudança incompatível: `!` após o tipo (`feat!:`) e/ou rodapé `BREAKING CHANGE:`.
- Descrição no imperativo, minúscula, sem ponto final.

## Versionamento — SemVer

`MAJOR.MINOR.PATCH`, derivado dos commits:

- `fix` → PATCH
- `feat` → MINOR
- `BREAKING CHANGE` / `!` → MAJOR

Contratos de eventos em `contracts/events/` também seguem SemVer: mudança incompatível exige nova versão major do contrato.

## TDD

- Ciclo red → green → refactor: escreva o teste que falha antes do código de produção.
- Todo `feat` e `fix` vem acompanhado de teste; um `fix` começa por um teste que reproduz o bug.
- Teste o comportamento do domínio, não detalhes de implementação.

## Domain-Driven Design

- Use a linguagem ubíqua de [docs/GLOSSARIO.md](docs/GLOSSARIO.md) em código, testes, commits e issues.
- Respeite os contextos delimitados de [docs/MODELOS_DOMINIO.md](docs/MODELOS_DOMINIO.md): cada serviço em `services/` é um contexto; não compartilhe modelos nem bancos entre eles.
- Contextos se comunicam apenas por eventos de domínio (`contracts/events/`) ou APIs públicas.
- Regras de negócio ficam no domínio, livres de framework, banco e I/O; infraestrutura fica nas bordas.

## Decisões — ADRs

- Toda decisão importante gera um ADR em `docs/adr/`, no mesmo PR da mudança: escolha de stack, biblioteca ou serviço externo, padrão arquitetural, limites entre contextos, formato de contratos, persistência, segurança.
- Na dúvida se é importante: se for cara de reverter ou afetar mais de um contexto, escreva o ADR.
- Um arquivo por decisão: `NNNN-titulo-em-kebab-case.md`, numeração sequencial (`0001`, `0002`, ...).
- ADR aceito não é editado; para mudar a decisão, crie um novo ADR e marque o antigo como `Substituído por NNNN`.
- Mantenha o índice em `docs/adr/README.md` (número, título e status) atualizado no mesmo PR.
- Commit com tipo `docs(adr)`.

Formato:

```markdown
# NNNN. Título

- Status: Proposto | Aceito | Substituído por NNNN
- Data: AAAA-MM-DD

## Contexto
Problema e forças em jogo.

## Decisão
O que foi decidido.

## Consequências
Ganhos, custos e riscos.
```

## Estilo — funcional antes de OOP

- Prefira funções puras e dados imutáveis (`readonly`, `const`, sem mutação de argumentos).
- Modele o domínio com tipos (`type`, uniões discriminadas) e funções, em vez de classes e herança.
- Componha funções pequenas; isole efeitos colaterais (I/O, tempo, aleatoriedade) nas bordas.
- Trate erros esperados como valores de retorno (ex.: `Result`), não com exceções.
- Use classes só quando uma biblioteca ou framework exigir.

## Documentação

- Todo export em `src/` tem comentário TSDoc (`/** ... */`) logo acima, verificado por `pnpm lint` ([ADR 0010](docs/adr/0010-tsdoc-obrigatorio-nos-exports.md)).
- Rota pública nova ou alterada atualiza `gateway/openapi.yaml` no mesmo PR ([ADR 0009](docs/adr/0009-openapi-da-api-publica.md)). Esse documento é público: descreve só o contrato, sem conhecimento, detalhes ou decisões internas (ADRs, serviços, infraestrutura, claims).
