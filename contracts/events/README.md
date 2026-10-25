# Contratos de eventos

Contratos dos eventos de domínio trocados entre os contextos pelo RabbitMQ. Fonte: [Modelos de domínio §3](../../docs/MODELOS_DOMINIO.md#eventos-entre-contextos). Decisão: [ADR 0004](../../docs/adr/0004-contratos-dos-eventos-de-dominio.md).

- `envelope.v1.json`: campos comuns a todo evento.
- `<tipo>.v<versao>.json`: um JSON Schema (draft-07) por evento e versão major, com um exemplo.
- `asyncapi.json`: exchange, routing keys, filas, quem publica e quem consome.

Os testes em `contracts/src/eventos.test.ts` validam os schemas e os exemplos e conferem que o `asyncapi.json` e a tabela abaixo batem com o modelo de domínio.

## Envelope

```json
{
  "id": "0b6f2f0e-6a1c-4c55-9a43-6f1f1b0c9e13",
  "tipo": "participacao.cota-devida",
  "versao": 1,
  "ocorridoEm": "2026-11-01T03:00:00Z",
  "payload": { "...": "definido no schema do evento" }
}
```

- `id`: UUID do evento. Consumidores o usam para descartar entregas repetidas (idempotência).
- `tipo`: `<contexto>.<evento>`, em kebab-case e sem acentos.
- `versao`: versão major do contrato.
- `ocorridoEm`: quando o fato aconteceu, em ISO 8601 com fuso.
- `payload`: dados do evento. Valores em dinheiro são inteiros em centavos (`valorEmCentavos`); pessoas são identificadas por `participanteId`, o mesmo identificador do contexto Usuário.

## Exchange, routing keys e filas

- **Exchange**: um só, `facoffee.eventos`, do tipo `topic` e durável.
- **Routing key**: `<tipo>.v<versao>`, igual ao nome do arquivo do schema (ex.: `participacao.cota-devida.v1`).
- **Filas**: uma fila durável por contexto consumidor, `<contexto>.eventos`, ligada às routing keys que ele consome. Uma fila só por consumidor mantém a ordem dos eventos de um mesmo publicador.
- Mensagens persistentes, em JSON (`content-type: application/json`).

| Evento | Routing key | Publicador | Filas consumidoras |
|---|---|---|---|
| Usuário desativado | `usuario.usuario-desativado.v1` | Usuário | `participacao.eventos` |
| Participante entrou | `participacao.participante-entrou.v1` | Participação | `financeiro.eventos` |
| Participante saiu | `participacao.participante-saiu.v1` | Participação | `financeiro.eventos` |
| Cota devida | `participacao.cota-devida.v1` | Participação | `financeiro.eventos` |
| Valor da cota definido | `participacao.valor-da-cota-definido.v1` | Participação | `notificacao.eventos` |
| Pagamento recebido | `financeiro.pagamento-recebido.v1` | Financeiro | `notificacao.eventos` |
| Complemento solicitado | `financeiro.complemento-solicitado.v1` | Financeiro | `notificacao.eventos` |
| Reembolso feito | `financeiro.reembolso-feito.v1` | Financeiro | `notificacao.eventos` |

## Versionamento

Cada contrato segue SemVer; a versão major está no nome do arquivo, na routing key e em `versao`.

- **Mudança compatível** (novo campo opcional no payload, descrição, exemplo): edita o schema da versão atual. Consumidores ignoram campos que não conhecem (leitor tolerante); por isso os schemas não fecham `additionalProperties`.
- **Mudança incompatível** (remover ou renomear campo, tornar campo obrigatório, mudar tipo ou significado): cria `<tipo>.v<N+1>.json` com a nova routing key. O publicador publica as duas versões até todos os consumidores migrarem; só então a versão antiga é removida.
- `info.version` do `asyncapi.json` versiona o conjunto: PATCH para descrições e exemplos, MINOR para campo opcional, evento ou versão nova, MAJOR para remoção de evento ou de versão.
