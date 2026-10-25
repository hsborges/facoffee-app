# 0017. Gatilhos de tempo do agendador

- Status: Aceito
- Data: 2026-10-25

## Contexto

Pelo [ADR 0001](0001-arquitetura-servicos.md), o agendador é um processo na rede interna que chama Participação no início do mês e no início do ano. Todo início de mês, cada participante ativo passa a dever a cota, com o valor do seu tipo de cota naquele mês, e o valor não muda depois de devida. Todo início de ano dispara a política de definir o valor da cota, mas só o gestor define o valor, uma vez por ano ([issue #17](https://github.com/hsborges/facoffee-app/issues/17)).

Forças em jogo:

- O agendador pode estar fora do ar na virada do mês, e Participação pode falhar no meio de um disparo.
- Rodar o gatilho duas vezes no mesmo mês não pode gerar cota em dobro.
- Sem valor da cota para o ano, a cota de janeiro não tem valor.
- O gateway encaminha todo `/api/participacao/*` a Participação; um gatilho exposto ali seria disparado por qualquer usuário logado.

## Decisão

**Gatilhos em Participação**: duas rotas internas, sem identidade, que usam o relógio de Participação no fuso de Campo Grande ([ADR 0015](0015-fuso-horario-do-dominio.md)):

- `POST /iniciar-ano`: cada tipo de cota sem valor para o ano atual repete o valor do ano anterior e publica *Valor da cota definido*. Se o gestor já definiu, nada muda. Responde `{ valoresRepetidos }`.
- `POST /iniciar-mes`: cada participante ativo que ainda não deve a cota do mês passa a devê-la, e *Cota devida* é publicada com o valor do seu tipo de cota naquele mês. Responde `{ cotasDevidas, semValorDaCota }`.

**Idempotência**: a tabela `cotas_devidas` tem chave primária (participante, mês); a cota e o evento entram no outbox na mesma transação, só se a cota ainda não existia. Repetir o gatilho só alcança quem entrou no mês depois do disparo anterior: quem entra durante o mês também deve a cota daquele mês. O participante cujo tipo de cota não tem valor no ano fica para o próximo disparo.

**Agendador**: processo Node sem dependências, sem banco e sem servidor HTTP. Ao subir e depois a cada hora, chama `iniciar-ano` e, se der certo, `iniciar-mes`; o ano vem antes para janeiro achar o valor do ano. Configuração: `PARTICIPACAO_URL`.

**Gateway**: a rota de Participação no Traefik exclui `/api/participacao/iniciar-ano` e `/api/participacao/iniciar-mes`, que respondem 404 de fora.

## Consequências

Ganhos:

- Um disparo perdido ou com falha é refeito na hora seguinte, sem estado no agendador.
- A cota é devida uma vez por participante e mês, mesmo com disparos repetidos ou concorrentes.
- A cota de janeiro sempre tem valor depois do primeiro ano, mesmo que o gestor não defina um novo.

Custos:

- A cota do mês é devida até uma hora depois da virada.
- O gestor precisa definir o valor do ano antes da virada: depois que o valor do ano anterior é repetido, o valor do ano não muda mais.
- Uma consulta a Participação por hora, quase sempre sem efeito.

Riscos:

- Sem valor no primeiro ano de uso, ninguém deve cota até o gestor definir o valor; o agendador registra `semValorDaCota` no log.
- Os gatilhos confiam só no bloqueio do gateway: Participação não pode ser alcançável de fora da rede interna.
