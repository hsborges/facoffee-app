# 0033. E2E como teste de aceitação da funcionalidade

- Status: Aceito
- Data: 2026-10-26

## Contexto

Com `docs/requisitos/` ([ADR 0032](0032-requisitos-rastreaveis-em-bdd.md)), cada funcionalidade (`RF`) e cada regra (`RN`) tem um ID, e o `pnpm lint` exige que toda `RN` seja citada por algum teste. O teste ponta a ponta ([ADR 0023](0023-teste-ponta-a-ponta-com-playwright.md)) não seguia essa organização ([issue #98](https://github.com/hsborges/facoffee-app/issues/98)):

- Um arquivo só, `e2e/fluxo-de-eventos.spec.ts`, com 5 testes longos que atravessavam várias funcionalidades cada um.
- Só 10 IDs citados; várias regras eram exercitadas em `test.step` sem citar o ID.
- Nenhuma verificação para `RF`: o lint não exigia teste de funcionalidade, e RF-PAR-02 *Trocar tipo de cota* não tinha nenhum teste ponta a ponta.

## Decisão

**O e2e é o teste de aceitação de cada funcionalidade.** Um spec por `RF`, no caminho espelhado de `docs/requisitos/` (`docs/requisitos/participacao/entrar-na-copa.md` → `e2e/participacao/entrar-na-copa.spec.ts`), com o ID no `test.describe` (`'RF-PAR-01 Entrar na copa'`). Os não funcionais verificáveis de ponta a ponta ficam em `e2e/nao-funcionais.spec.ts`.

- **Um teste por regra observável de ponta a ponta**, começando pelo ID: `test('RN-PAR-02: quem já participa não entra de novo', ...)`. Os cenários da mesma regra viram `test.step`. As regras que dependem do relógio ou de casos de borda que não valem uma stack inteira ficam só nos testes de unidade e integração.
- **Cada teste é independente**: usuários novos (`novoUsuario`), sem depender da ordem nem de outro teste, e roda sozinho (`--grep "RN-PAR-02"`). O que é definido uma vez por stack, como o valor da cota do ano, é definido pelo primeiro teste que precisa dele. Continuam em série (`workers: 1`); os testes das telas levam a tag `@celular`.
- **Os helpers ficam em `e2e/apoio.ts`.**
- **Elementos pelo `data-testid`**, não pelo texto, rótulo ou papel: mudar um texto do web não quebra o teste, e um teste novo não depende da redação de outra tela. O `data-testid` é em português, kebab-case, sem acento, com termos do glossário (`pedir-entrada`, `comprovante-a-confirmar`). O que se repete (linhas de uma tabela) leva o mesmo `data-testid` e é filtrado pelos dados do próprio teste (o nome da pessoa, o valor); o estado vai em atributos `data-*` com os valores da API (`data-situacao="a-confirmar"`, `data-tipo-de-cota="so-cafe"`). O teste confere o estado que o comando produz, não a mensagem de sucesso. Fica de fora só o formulário de login, que é do Keycloak e já tem `id`s estáveis.
- **Além do que o ADR 0023 já tira de fora do web** (e-mail, *Crédito e pendentes* de todos, *Todo início de mês*), o teste chama a API com a sessão da pessoa para o que o web não deixa tentar: os pedidos recusados (um participante recebendo pagamento, a entrada repetida) e o gasto registrado por quem não é gestor. Também lê pela API o que o web não mostra e o teste precisa: os ids (do usuário, do comprovante, do gasto) e os números que compara antes e depois (a situação do participante, o saldo da caixinha, a caixinha do mês).
- **`pnpm lint` exige que toda `RF` seja citada pelo seu spec no caminho espelhado**; as `RN` continuam exigindo ao menos um teste em qualquer nível. `node scripts/check-requisitos.ts --matriz` lista, por `RF`, os specs e2e e, por `RN`, os testes.

## Consequências

Ganhos:

- Funcionalidade nova sem spec e2e quebra o lint; a matriz mostra, por funcionalidade, onde ela é aceita.
- Um teste que falha diz a regra quebrada pelo nome; cada um roda sozinho.
- Os testes não quebram quando um texto, rótulo ou mensagem do web muda; só quando muda o `data-testid` ou o comportamento.

Custos:

- Mais testes e mais logins: a execução fica mais longa que os 5 testes de antes, e testes que dependem do *Todo início de mês* reiniciam o agendador cada um.
- Funcionalidade nova vem com o seu spec, mesmo quando o comportamento já está nos testes de unidade.
- O web leva `data-testid` e `data-*` nos elementos que os testes usam; tela nova os inclui.

Riscos:

- Os testes compartilham a stack: o que um conta (participantes ativos, saldo da caixinha) muda com o que outro faz. Por isso comparam antes e depois, dentro do mesmo teste, e rodam em série.
- Sem localizar por papel e nome acessível, o teste deixa de conferir de passagem os rótulos que o leitor de tela anuncia; a acessibilidade fica com a revisão e com o Design System ([ADR 0028](0028-mobile-first.md)).
