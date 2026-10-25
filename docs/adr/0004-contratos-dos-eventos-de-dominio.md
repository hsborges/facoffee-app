# 0004. Contratos dos eventos de domínio

- Status: Aceito
- Data: 2026-10-25

## Contexto

O [ADR 0001](0001-arquitetura-servicos.md) define que os contextos só se comunicam por eventos de domínio via RabbitMQ, com contratos em `contracts/events/` versionados por SemVer. O [ADR 0002](0002-stack.md) escolhe JSON Schema por evento e versão major, e AsyncAPI para canais, publicadores e consumidores. Faltam o formato comum das mensagens, a topologia no RabbitMQ e a regra de versionamento.

Forças em jogo:

- Os consumidores devem ser idempotentes, porque o broker pode entregar a mesma mensagem mais de uma vez.
- Financeiro depende da ordem dos eventos de Participação (entrou, cota devida, saiu).
- Um contrato muda sem que todos os serviços sejam implantados juntos.

## Decisão

**Envelope**: todo evento tem `id` (UUID), `tipo` (`<contexto>.<evento>`), `versao` (major do contrato), `ocorridoEm` (ISO 8601 com fuso) e `payload`. Valores em dinheiro são inteiros em centavos. Pessoas são identificadas pelo mesmo identificador do contexto Usuário (sub do Passaporte UFMS).

**Schemas**: JSON Schema draft-07, a versão padrão do AsyncAPI 3, um arquivo `<tipo>.v<versao>.json` por evento e versão major, com exemplo validado em teste.

**RabbitMQ**:

- Um exchange `facoffee.eventos`, `topic`, durável.
- Routing key `<tipo>.v<versao>`, igual ao nome do arquivo do schema.
- Uma fila durável por contexto consumidor, `<contexto>.eventos`, ligada às routing keys que ele consome.

**Versionamento**:

- Mudança compatível (campo opcional novo, descrição, exemplo) edita o schema da versão atual. Consumidores ignoram campos desconhecidos (leitor tolerante).
- Mudança incompatível cria a versão major seguinte, com nova routing key. O publicador publica as duas versões até todos os consumidores migrarem.
- `info.version` do `asyncapi.json` versiona o conjunto de contratos por SemVer.

Detalhes e tabela de eventos em [contracts/events/README.md](../../contracts/events/README.md).

## Consequências

Ganhos:

- Um só exchange e uma fila por consumidor: topologia simples e ordem preservada por publicador.
- A versão na routing key permite publicar duas versões em paralelo, sem quebrar quem ainda não migrou.
- Testes conferem que schemas, AsyncAPI e o modelo de domínio não divergem.

Custos:

- Uma fila por consumidor serializa o processamento: um evento lento atrasa os outros do mesmo consumidor.
- Durante uma migração de versão major, o publicador mantém duas versões do evento.

Riscos:

- O leitor tolerante deixa passar campos digitados errado no payload; o publicador deve validar o evento contra o schema antes de publicar.
- Não há fila de mensagens mortas: uma mensagem que sempre falha trava a fila do consumidor até ser tratada.
