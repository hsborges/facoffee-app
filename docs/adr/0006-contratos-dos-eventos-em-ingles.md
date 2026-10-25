# 0006. Contratos dos eventos em inglês

- Status: Aceito
- Data: 2026-10-25

## Contexto

O [ADR 0004](0004-contratos-dos-eventos-de-dominio.md) definiu os contratos dos eventos com nomes em português: campos do envelope (`tipo`, `versao`, `ocorridoEm`), tipos e routing keys (`participacao.cota-devida.v1`), campos do payload, exchange `facoffee.eventos` e filas `<contexto>.eventos`. O [ADR 0005](0005-template-de-servico.md) seguiu a mesma convenção na fila de mensagens mortas, `<contexto>.eventos.mortas`.

O template de serviço é escrito em inglês, e os contratos são a API pública entre os contextos: misturar português nos nomes trocados pela rede e inglês no código que os lê deixa as duas pontas incoerentes. Nenhum serviço publica nem consome eventos ainda, então trocar os nomes agora não quebra ninguém.

Forças em jogo:

- A linguagem ubíqua é em português ([glossário](../GLOSSARIO.md)); nomes em inglês exigem uma tradução única e registrada para cada termo.
- O ADR 0004 exige versão major nova para mudança incompatível, o que faria sentido só se a v1 já tivesse sido publicada.

## Decisão

Substitui o ADR 0004. Tudo o que ele decidiu continua valendo, com os nomes em inglês:

**Envelope**: `id` (UUID), `type` (`<context>.<event>`), `version` (major do contrato), `occurredAt` (ISO 8601 com fuso) e `payload`. Valores em dinheiro são inteiros em centavos (`amountInCents`). Pessoas são identificadas pelo mesmo identificador do contexto Usuário (sub do Passaporte UFMS).

**Nomes**: campos, tipos, routing keys, exchange e filas em inglês; campos do payload em camelCase; tipos e routing keys em kebab-case. Títulos e descrições dos schemas continuam em português, na linguagem ubíqua.

**Traduções**:

- A seção [Nomes nos contratos de eventos](../GLOSSARIO.md#nomes-nos-contratos-de-eventos) do glossário é a única fonte: uma tabela de termos e uma de eventos, um só nome em inglês por termo.
- A tradução segue a definição do glossário, não a semelhança da palavra. Falsos cognatos e termos a evitar ficam registrados na coluna de observação (ex.: *Cota* é `contribution`, não `quota`; *Complemento* é `top-up`, não `complement`; *Reembolso* é `reimbursement`, não `refund`).
- Testes em `contracts/` garantem que o tipo de cada evento é `<contexto>.<evento>` com os nomes do glossário e recusam campo ou valor de enum do payload com palavra que não esteja na tabela de termos. Termo novo num contrato entra antes no glossário.

**Schemas**: JSON Schema draft-07, um arquivo `<type>.v<version>.json` por evento e versão major, com exemplo validado em teste.

**RabbitMQ**:

- Um exchange `facoffee.events`, `topic`, durável.
- Routing key `<type>.v<version>`, igual ao nome do arquivo do schema.
- Uma fila durável por contexto consumidor, `<context>.events`, ligada às routing keys que ele consome.
- Fila de mensagens mortas `<context>.events.dead-letter`, no lugar de `<contexto>.eventos.mortas` do ADR 0005. O resto do ADR 0005 não muda.

**Versionamento**: as mesmas regras do ADR 0004 (leitor tolerante, versão major nova para mudança incompatível, `info.version` do AsyncAPI por SemVer). Exceção única: esta troca de nomes edita a v1 e mantém `info.version` em `1.0.0`, porque a v1 nunca foi publicada.

## Consequências

Ganhos:

- Contratos e código dos serviços na mesma língua; o template lê e escreve os campos sem tradução.
- Testes conferem que tipos, routing keys, filas e nomes do payload batem com o glossário; uma palavra não registrada não entra num contrato.

Custos:

- Cada termo do domínio que entra num contrato precisa de um nome em inglês no glossário antes de ser usado.
- Quem lê uma mensagem no RabbitMQ precisa da tabela de tradução para ligá-la ao modelo de domínio.

Riscos:

- O teste garante que toda palavra está registrada, não que a tradução é boa: uma tradução nova no glossário precisa de revisão no PR, conferindo a definição do termo.
- A exceção ao versionamento não vale de novo: depois que um serviço publicar a v1, renomear exige v2.
