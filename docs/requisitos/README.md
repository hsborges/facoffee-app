# Requisitos

Fonte única dos requisitos e das regras de negócio do FACOFFEE, especificados em BDD (Gherkin em português) e rastreados por ID até os testes ([ADR 0032](../adr/0032-requisitos-rastreaveis-em-bdd.md)). Um arquivo por funcionalidade, numa subpasta por contexto delimitado; os não funcionais em [`nao-funcionais.md`](nao-funcionais.md).

| Tipo | ID | Em Gherkin |
|---|---|---|
| Requisito funcional | `RF-<CTX>-NN` | `Funcionalidade` |
| Regra de negócio | `RN-<CTX>-NN` | `Regra`, com um ou mais `Cenário` |
| Requisito não funcional | `RNF-NN` | `Cenário`, quando verificável por teste |

`<CTX>`: `PAR` (Participação), `FIN` (Financeiro), `USU` (Usuário), `NOT` (Notificação), `AGE` (Agendador), `WEB` (Web). Os testes citam o ID da regra no nome (`it('RN-FIN-07: ...')`); `node scripts/check-requisitos.ts --matriz` gera a matriz de rastreabilidade.

| ID | Funcionalidade | Contexto | Regras |
|---|---|---|---|
| [RF-PAR-01](participacao/entrar-na-copa.md) | Entrar na copa | Participação | RN-PAR-01, RN-PAR-02, RN-PAR-03, RN-PAR-04 |
| [RF-PAR-02](participacao/trocar-tipo-de-cota.md) | Trocar tipo de cota | Participação | RN-PAR-05, RN-PAR-06 |
| [RF-PAR-03](participacao/sair-da-copa.md) | Sair da copa | Participação | RN-PAR-07, RN-PAR-08 |
| [RF-PAR-04](participacao/dever-a-cota-do-mes.md) | Dever a cota do mês | Participação | RN-PAR-09, RN-PAR-10, RN-PAR-11, RN-PAR-12 |
| [RF-PAR-05](participacao/definir-o-valor-da-cota.md) | Definir o valor da cota | Participação | RN-PAR-13, RN-PAR-14, RN-PAR-15, RN-PAR-16 |
| [RF-FIN-01](financeiro/receber-pagamento.md) | Receber pagamento | Financeiro | RN-FIN-01, RN-FIN-02, RN-FIN-03, RN-FIN-04, RN-FIN-05, RN-FIN-06 |
| [RF-FIN-02](financeiro/enviar-comprovante.md) | Enviar comprovante | Financeiro | RN-FIN-07, RN-FIN-08, RN-FIN-09, RN-FIN-10, RN-FIN-11, RN-FIN-12, RN-FIN-13, RN-FIN-14 |
| [RF-FIN-03](financeiro/credito-e-pendentes.md) | Crédito e pendentes | Financeiro | RN-FIN-15, RN-FIN-16, RN-FIN-17, RN-FIN-18, RN-FIN-19, RN-FIN-20, RN-FIN-21 |
| [RF-FIN-04](financeiro/registrar-gasto-e-reembolsar.md) | Registrar gasto e reembolsar | Financeiro | RN-FIN-22, RN-FIN-23, RN-FIN-24, RN-FIN-25, RN-FIN-26 |
| [RF-FIN-05](financeiro/solicitar-complemento.md) | Solicitar complemento | Financeiro | RN-FIN-27, RN-FIN-28, RN-FIN-29 |
| [RF-FIN-06](financeiro/acompanhar-a-caixinha.md) | Acompanhar a caixinha | Financeiro | RN-FIN-30, RN-FIN-31, RN-FIN-32, RN-FIN-33 |
| [RF-USU-01](usuario/acesso-ao-facoffee.md) | Acesso ao FACOFFEE | Usuário | RN-USU-01, RN-USU-02, RN-USU-03, RN-USU-04, RN-USU-05, RN-USU-06 |
| [RF-NOT-01](notificacao/avisar-os-participantes.md) | Avisar os participantes | Notificação | RN-NOT-01, RN-NOT-02, RN-NOT-03, RN-NOT-04, RN-NOT-05, RN-NOT-06 |
| [RF-NOT-02](notificacao/lembrar-os-pendentes.md) | Lembrar os pendentes | Notificação | RN-NOT-07, RN-NOT-08, RN-NOT-09, RN-NOT-10 |

Não funcionais: [RNF-01 a RNF-11](nao-funcionais.md).
