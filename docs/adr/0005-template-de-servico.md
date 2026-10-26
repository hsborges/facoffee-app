# 0005. Template de serviço

- Status: Aceito; Dockerfile e ambiente local substituídos por 0026
- Data: 2026-10-25

## Contexto

O [ADR 0002](0002-stack.md) diz que todos os serviços usam a mesma stack, gerada a partir de um template, e que Hono e Drizzle deixam estrutura de pastas e tratamento de erros a cargo do template. O [ADR 0001](0001-arquitetura-servicos.md) exige consumidores idempotentes e entrega confiável. O [ADR 0004](0004-contratos-dos-eventos-de-dominio.md) definiu envelope, exchange e uma fila por consumidor, mas deixou dois riscos: o evento pode se perder entre o commit no banco e a publicação, e não há fila de mensagens mortas.

## Decisão

**Forma**: uma pasta copiável, `templates/service/`, autocontida. Cada serviço copia o template e o adapta; não há biblioteca compartilhada entre serviços. O template é um workspace do pnpm, então lint, testes e build rodam nele como em qualquer serviço. O código do template é em inglês, por não pertencer a nenhum contexto; o código de cada serviço usa a linguagem ubíqua.

**Camadas**: `domain/` (tipos e funções puras), `application/` (casos de uso que dependem de portas), `infra/` (banco, broker, config, logs) e `api/` (rotas Hono). Erros esperados são valores (`Result`); a raiz de composição (`service.ts`) liga as camadas.

**Operação**: configuração só por variáveis de ambiente, validada no startup; logs em JSON, uma linha por registro, no stdout; `GET /health` verifica banco e broker (200 ou 503); migrations do `drizzle-kit` aplicadas no startup; Dockerfile multi-stage com `pnpm deploy`, executado como usuário sem privilégios.

**Publicação (transactional outbox)**:

- O evento é gravado na tabela `outbox` na mesma transação do agregado.
- Um relay publica os pendentes em ordem, com *publisher confirms*, e só marca como publicado o que o broker confirmou. Para no primeiro erro, para não publicar fora de ordem.
- Garantia: pelo menos uma vez. Duplicatas são resolvidas pelo consumidor.

**Consumo**:

- Fila do ADR 0004 do tipo *quorum*, com prefetch 1 para manter a ordem.
- Idempotência: o id do evento é gravado em `processed_events` na mesma transação do tratador; se já existe, a mensagem é confirmada sem efeito.
- Retry: até 5 tentativas no próprio processo, com espera exponencial, sem devolver a mensagem à fila (devolver mudaria a ordem).
- Fila de mensagens mortas `<contexto>.eventos.mortas`, via *dead-letter* da fila principal: recebe o evento após as tentativas e, direto, mensagens com envelope inválido. Reprocessar é tarefa manual (mover de volta pelo painel do RabbitMQ).

**Ambiente local**: o compose ganha o banco `example` e o serviço `example` no perfil `example`, que comprova a publicação e o consumo de um evento.

## Consequências

Ganhos:

- Um evento não se perde se o broker cair: fica no outbox até ser confirmado.
- Entregas repetidas não duplicam efeitos; uma mensagem que sempre falha não trava a fila do consumidor.
- Todos os serviços começam com a mesma estrutura, observabilidade e testes.

Custos:

- Outbox e consumidor ficam copiados em cada serviço; uma correção neles precisa ser repetida em todas as cópias.
- Cada serviço tem duas tabelas de infraestrutura (`outbox`, `processed_events`) e um relay consultando o banco a cada 500 ms.
- Enquanto um evento está nas tentativas, os seguintes da mesma fila esperam (até ~15 s).

Riscos:

- Ordem no outbox segue a ordem de inserção; transações concorrentes podem fazer commit fora dessa ordem. Aceitável no volume do FACOFFEE; rever se surgirem eventos do mesmo agregado em transações paralelas.
- Evento na fila de mensagens mortas fica fora de ordem quando reprocessado; o tratador precisa tolerar isso ou a fila precisa ser esvaziada antes.
- O template só confere o envelope; a validação do payload contra os schemas de `contracts/events/` fica a cargo de cada serviço.
- Linhas publicadas do outbox e ids processados crescem sem limpeza.
