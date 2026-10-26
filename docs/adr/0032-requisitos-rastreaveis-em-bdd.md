# 0032. Requisitos rastreáveis em BDD

- Status: Aceito
- Data: 2026-10-26

## Contexto

Os requisitos e as regras de negócio do FACOFFEE existem, mas estão espalhados e sem identificador ([issue #96](https://github.com/hsborges/facoffee-app/issues/96)): as necessidades na [Visão de produto](../produto/VISAO.md#o-que-o-produto-precisa-garantir), as regras nas seções **Regras:** do [glossário](../dominio/GLOSSARIO.md) e na coluna *Regras que garante* dos agregados em [MODELOS.md](../dominio/MODELOS.md#agregados), parte delas repetida nos dois, e as decisões nos ADRs. Os ~400 testes não dizem qual regra cada um verifica.

Forças em jogo:

- Sem um ID estável por regra, não dá para responder "qual teste garante esta regra?", "de onde veio?" nem "que regra ficou sem teste?".
- A documentação é docs-as-code em Markdown, lida no GitHub; o `pnpm lint` já verifica convenções com scripts sem dependência ([ADR 0010](0010-tsdoc-obrigatorio-nos-exports.md)).
- Branches paralelas numerando regras colidiriam numa numeração única.
- Rodar cenários Gherkin como testes (`.feature` com `vitest-cucumber` ou `playwright-bdd`) traria uma dependência e uma segunda suíte para manter.

## Decisão

**Fonte única em `docs/requisitos/`**, um arquivo por funcionalidade, em subpasta por contexto delimitado, com índice em [`docs/requisitos/README.md`](../requisitos/README.md). O glossário e os modelos passam a apontar para as regras, sem repetir o texto. Sem versão nem histórico por arquivo: o histórico é o do git.

**IDs**: `RF-<CTX>-NN` para requisito funcional (uma `Funcionalidade`), `RN-<CTX>-NN` para regra de negócio (uma `Regra`, com um ou mais `Cenário`) e `RNF-NN` para requisito não funcional. `<CTX>` é o contexto: `PAR`, `FIN`, `USU`, `NOT`, `AGE` ou `WEB`. A numeração é por contexto, sequencial e nunca reutilizada. Uma regra usada por mais de uma funcionalidade fica no arquivo da principal; as demais apontam para ela.

**BDD como notação**: cada regra tem seus cenários em Gherkin em português, num bloco `gherkin` do Markdown, usando só termos do glossário. Os cenários são a especificação lida por pessoas; os testes Vitest e Playwright continuam sendo a verificação executável.

**Ligação com os testes**: o teste cita o ID da regra no nome (`it('RN-FIN-07: ...')`). Uma regra que não dá para verificar por teste, porque está fora do sistema ou ainda não foi implementada, leva a linha `- Verificação: revisão`, com o motivo.

**Verificação no `pnpm lint`** (`scripts/check-requisitos.ts`): IDs únicos; todo ID citado em teste existe; o índice lista todas as funcionalidades da pasta, com as suas regras, e só elas; toda `RN` e `RNF` tem ao menos um teste ou está marcada `Verificação: revisão`. `--matriz` gera a matriz de rastreabilidade (RF → RN → testes) em Markdown.

Descartado: rodar os cenários como testes. Fica para quando houver uma regra crítica que o gestor precise ler e validar direto no teste.

## Consequências

Ganhos:

- Cada regra tem um lugar, um ID, uma origem e os testes que a garantem; a matriz sai do código, não de uma planilha.
- Regra nova sem teste, ou teste citando regra que não existe, quebra o lint.
- Nenhuma dependência nova.

Custos:

- Toda regra nova ou alterada mexe em `docs/requisitos/`, no índice e no nome do teste, no mesmo PR.
- O glossário perde a leitura corrida das regras: quem lê precisa seguir o link.

Riscos:

- Os cenários não rodam: podem descolar do teste sem que o lint perceba. A revisão do PR confere os dois.
- O vínculo é pelo nome do teste; um teste renomeado some da matriz, e o lint só acusa se a regra ficar sem nenhum.
