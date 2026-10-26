# Contratos de eventos

Contratos dos eventos de domínio trocados entre os contextos pelo RabbitMQ. Fonte: [Modelos de domínio §3](../../docs/dominio/MODELOS.md#eventos-entre-contextos). Decisão: [ADR 0006](../../docs/adr/0006-contratos-dos-eventos-em-ingles.md).

Os nomes nos contratos (campos, tipos, routing keys, filas) são em inglês; títulos e descrições ficam em português, na linguagem ubíqua. A tradução de cada termo está em [Nomes nos contratos de eventos](../../docs/dominio/GLOSSARIO.md#nomes-nos-contratos-de-eventos), no glossário.

- `envelope.v1.json`: campos comuns a todo evento.
- `<type>.v<version>.json`: um JSON Schema (draft-07) por evento e versão major, com um exemplo.
- `asyncapi.json`: exchange, routing keys, filas, quem publica e quem consome.

Os testes em `contracts/src/eventos.test.ts` validam os schemas e os exemplos e conferem que o `asyncapi.json`, a tabela abaixo e o glossário batem com o modelo de domínio.

## Envelope

```json
{
  "id": "0b6f2f0e-6a1c-4c55-9a43-6f1f1b0c9e13",
  "type": "participation.contribution-due",
  "version": 1,
  "occurredAt": "2026-11-01T03:00:00Z",
  "payload": { "...": "definido no schema do evento" }
}
```

- `id`: UUID do evento. Consumidores o usam para descartar entregas repetidas (idempotência).
- `type`: `<context>.<event>`, em inglês e kebab-case.
- `version`: versão major do contrato.
- `occurredAt`: quando o fato aconteceu, em ISO 8601 com fuso.
- `payload`: dados do evento, com campos em camelCase. Valores em dinheiro são inteiros em centavos (`amountInCents`); pessoas são identificadas por `participantId`, o mesmo identificador do contexto Usuário.

## Exchange, routing keys e filas

- **Exchange**: um só, `facoffee.events`, do tipo `topic` e durável.
- **Routing key**: `<type>.v<version>`, igual ao nome do arquivo do schema (ex.: `participation.contribution-due.v1`).
- **Filas**: uma fila durável por contexto consumidor, `<context>.events`, ligada às routing keys que ele consome. Uma fila só por consumidor mantém a ordem dos eventos de um mesmo publicador. Cada fila tem a sua fila de mensagens mortas, `<context>.events.dead-letter` ([ADR 0005](../../docs/adr/0005-template-de-servico.md)).
- Mensagens persistentes, em JSON (`content-type: application/json`).

| Evento | Routing key | Publicador | Filas consumidoras |
|---|---|---|---|
| Usuário desativado | `user.user-deactivated.v1` | Usuário | `participation.events` |
| Participante entrou | `participation.participant-joined.v1` | Participação | `finance.events` |
| Participante saiu | `participation.participant-left.v1` | Participação | `finance.events` |
| Cota devida | `participation.contribution-due.v1` | Participação | `finance.events` |
| Valor da cota definido | `participation.contribution-amount-set.v1` | Participação | `notification.events` |
| Pagamento recebido | `finance.payment-received.v1` | Financeiro | `notification.events` |
| Complemento solicitado | `finance.top-up-requested.v1` | Financeiro | `notification.events` |
| Reembolso feito | `finance.reimbursement-made.v1` | Financeiro | `notification.events` |

## Versionamento

Cada contrato segue SemVer; a versão major está no nome do arquivo, na routing key e em `version`.

- **Mudança compatível** (novo campo opcional no payload, descrição, exemplo): edita o schema da versão atual. Consumidores ignoram campos que não conhecem (leitor tolerante); por isso os schemas não fecham `additionalProperties`.
- **Mudança incompatível** (remover ou renomear campo, tornar campo obrigatório, mudar tipo ou significado): cria `<type>.v<N+1>.json` com a nova routing key. O publicador publica as duas versões até todos os consumidores migrarem; só então a versão antiga é removida.
- `info.version` do `asyncapi.json` versiona o conjunto: PATCH para descrições e exemplos, MINOR para campo opcional, evento ou versão nova, MAJOR para remoção de evento ou de versão.
