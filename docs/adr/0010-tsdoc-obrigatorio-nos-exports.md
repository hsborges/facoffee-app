# 0010. TSDoc obrigatório nos exports

- Status: Proposto
- Data: 2026-10-25

## Contexto

Os exports de um módulo são a interface que o resto do código usa: funções, tipos e constantes do template de serviço, do gateway e dos serviços. Até aqui poucos tinham comentário, e os que tinham usavam `//`, que o editor não mostra ao passar o mouse nem ao autocompletar.

Forças em jogo:

- O template de serviço é copiado por todos os contextos; o que não estiver documentado nele se repete sem explicação.
- Regra sem verificação automática não se sustenta.
- O Biome, linter do projeto ([ADR 0002](0002-stack.md)), não tem regra que exija comentário de documentação; ESLint com `eslint-plugin-jsdoc` seria um segundo linter só para isso.

## Decisão

- Todo export de nível superior em `src/` (função, tipo, constante, classe) tem um comentário TSDoc (`/** ... */`) logo acima, sem linha em branco entre os dois.
- O comentário diz o que o export faz e o que não é óbvio pela assinatura: regras, efeitos, erros, decisões (ADR). Não repete os tipos.
- Ficam de fora: arquivos de teste (`*.test.ts`), re-exports (`export { x } from`, `export *`) e `export {}`.
- `scripts/check-tsdoc.ts`, sem dependências, verifica a regra e roda em `pnpm lint`; o lint falha listando `arquivo:linha` de cada export sem TSDoc.

## Consequências

Ganhos:

- A documentação aparece no editor, onde o código é usado.
- A regra é verificada a cada `pnpm lint`, sem dependência nova.

Custos:

- Todo export novo exige um comentário, inclusive os óbvios.

Riscos:

- A verificação é por linhas, não por análise sintática: confere a presença do comentário, não a qualidade. Exports em formatos incomuns (ex.: várias declarações em um `export const`) podem escapar; se isso acontecer, trocar o script pela API do TypeScript.
