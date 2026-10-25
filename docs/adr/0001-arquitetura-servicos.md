# 0001. Arquitetura baseada em serviços

- Status: Proposto
- Data: 2026-10-24

## Contexto

O FACOFFEE divide os custos da copa da FACOM. O domínio já foi separado em contextos delimitados em [MODELOS_DOMINIO.md §3](../MODELOS_DOMINIO.md#3-contextos-delimitados), e a arquitetura foi desenhada em [arquitetura.png](../arquitetura.png). Falta registrar as decisões que esses documentos assumem.

Forças em jogo:

- Os contextos devem evoluir de forma independente, sem compartilhar modelos nem dados.
- Os eventos entre contextos já estão definidos (quem publica e quem consome).
- A dependência entre os contextos não pode formar ciclos.
- Só o que precisa ficar exposto deve ficar na rede pública.

## Decisão

Adotar uma arquitetura baseada em serviços, com um serviço por contexto.

**Serviços**

| Serviço | Tipo | Responsabilidade |
|---|---|---|
| **Usuário** | Domínio | Acesso das pessoas, autenticadas pelo Passaporte UFMS (Keycloak, OIDC). |
| **Participação** | Domínio | Participante, Tipo de cota, Valor da cota e Cota. |
| **Financeiro** | Domínio | Pagamento, Comprovante, Crédito, Complemento, Caixinha, Gasto, Nota e Reembolso. Guarda comprovantes e notas em armazenamento de arquivos. |
| **Notificação** | Suporte | Avisos aos participantes por e-mail (Gmail) e WhatsApp. |
| **Agendador** | Infraestrutura | Dispara os gatilhos de tempo de Participação: início do mês e início do ano. |

**Dados**

- Cada serviço tem o próprio banco de dados.
- Nenhum serviço lê ou escreve no banco de outro.

**Comunicação**

- Chamadas síncronas (REST) só partem do API Gateway para os serviços.
- Entre serviços, a comunicação é só por eventos de domínio, via RabbitMQ. Os contratos ficam em `contracts/events/`.
- Eventos publicados e consumidos por cada serviço:

| Serviço | Publica | Consome |
|---|---|---|
| **Usuário** | Usuário desativado | — |
| **Participação** | Participante entrou, Participante saiu, Cota devida, Valor da cota definido | Usuário desativado |
| **Financeiro** | Pagamento recebido, Complemento solicitado, Reembolso feito | Cota devida, Participante entrou, Participante saiu |
| **Notificação** | — | Valor da cota definido, Pagamento recebido, Complemento solicitado, Reembolso feito |

**Direção das dependências**

- A dependência tem uma só direção: Usuário → Participação → Financeiro.
- Um serviço nunca consome eventos de quem está depois dele nessa cadeia.
- Participação traduz *Usuário desativado* em *Participante saiu*; o termo "usuário" não entra no modelo de Participação.

**Redes**

- Só o API Gateway fica na rede pública.
- Serviços, bancos, RabbitMQ, Agendador e armazenamento de arquivos ficam na rede interna.

## Consequências

Ganhos:

- Cada contexto evolui, é testado e é implantado sem depender do modelo nem do banco dos outros.
- A dependência em uma direção evita ciclos e deixa claro quem precisa saber do quê.
- A superfície exposta se limita ao gateway.
- Uma falha em Financeiro ou Notificação não impede Participação de publicar eventos; eles são processados depois.

Custos:

- Mais peças para operar: um banco por serviço, RabbitMQ, gateway e agendador.
- Consistência eventual: Financeiro só vê uma entrada, saída ou cota devida depois de consumir o evento.
- Dados de outro contexto precisam ser mantidos como cópia local alimentada por eventos (ex.: *Participantes ativos* em Financeiro).
- Os contratos de eventos viram API pública e seguem SemVer; mudança incompatível exige nova versão major.

Riscos:

- Perda ou duplicação de mensagens: os consumidores devem ser idempotentes e o broker deve ter entrega confiável.
- Consultas que cruzam contextos não podem ser feitas por banco nem por chamada entre serviços; precisam de leituras próprias em cada serviço ou de composição no gateway.
