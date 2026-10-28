# 0035. Normalização da API pública

- Status: Aceito
- Data: 2026-10-28

## Contexto

A revisão do [`gateway/openapi.yaml`](../../gateway/openapi.yaml) achou a API pública inconsistente entre os contextos e, em pontos, contrária ao [glossário](../dominio/GLOSSARIO.md):

- O mesmo conceito com nomes diferentes: `participando` em Participação e `ativo` em Financeiro; `pendenteEmCentavos` para o valor que o glossário chama de pendência; `feitoEm` para a data em que o gasto foi registrado.
- O perfil `participante` contraria o glossário: ter acesso não faz de ninguém um participante, e o perfil não era usado para nada.
- Códigos de erro em inglês e genéricos (`unauthorized`, `not-found`, `internal-error`) ao lado dos demais, em português e específicos.
- O mesmo caso com status diferentes: quem nunca participou recebia 404 num comando sobre si mesmo; uma regra de negócio recusava com 400 (`ano-passado`) e a outra, da mesma regra, com 409; um mês malformado no caminho dava 404.
- Comandos devolvendo ids que nenhuma rota recebe (pagamento, reembolso, complemento).
- A leitura dos valores da cota em `GET /api/participacao/tipo-de-cota`, nome de outro recurso ([ADR 0016](0016-nomenclatura-das-rotas-http.md)).
- Desativar o acesso de um usuário que nunca acessou o FACOFFEE respondia 204 e publicava *Usuário desativado*.
- O gestor não tinha como saber o tipo de cota de cada participante (RF-PAR-01).
- O documento público trazia o endereço do provedor de identidade local (Keycloak, realm e `localhost`).

## Decisão

Regras para a API pública, somadas às do [ADR 0016](0016-nomenclatura-das-rotas-http.md):

- **Um nome por conceito**, o do glossário, em todos os contextos: `participando`, `pendenciaEmCentavos`, `registradoEm`. O único perfil é `gestor`.
- **Códigos de erro** em português, kebab-case, específicos do recurso: `nao-autenticado`, `usuario-nao-encontrado`, `comprovante-nao-encontrado`, `nota-nao-encontrada`, `nunca-participou`, `ninguem-participando`, `erro-interno`.
- **Status:**
  - 400: o pedido está malformado, inclusive um parâmetro de caminho que não é um identificador, como o mês.
  - 401: sem autenticação.
  - 403: sem permissão.
  - 404: o recurso identificado não existe, ou a pessoa não pode vê-lo, inclusive com o identificador malformado.
  - 409: uma regra de negócio recusa o pedido no estado atual.
- **Comandos** respondem 204. Respondem 201 com `{ id }` só quando outra rota recebe esse id: guardar comprovante ou nota, enviar comprovante, registrar gasto.
- **Leituras** usam o substantivo do que devolvem.
- O documento público declara só o token `bearer`, sem o endereço do provedor de identidade.

Rotas e respostas que mudam, sem manter as antigas:

| Antes | Agora |
|---|---|
| `GET /api/participacao/tipo-de-cota` | `GET /api/participacao/valor-da-cota` |
| — | `GET /api/participacao/participante`, leitura *Participantes*, só para o gestor (RN-PAR-17) |
| `POST /api/usuario/{id}/desativar` e `/reativar` de quem nunca acessou: 204 | 404 `usuario-nao-encontrado` |
| `POST /api/participacao/definir-valor-da-cota` com ano passado: 400 | 409 `ano-passado` |
| `POST /api/financeiro/enviar-comprovante` e `/registrar-gasto` de quem nunca participou: 404 `participante-nao-encontrado` | 409 `nunca-participou` |
| `POST /api/financeiro/solicitar-complemento` sem participante: `sem-participantes-ativos` | `ninguem-participando` |
| `POST /api/financeiro/receber-pagamento`, `/comprovante-enviado/{id}/confirmar`, `/gasto/{id}/reembolsar`, `/solicitar-complemento`: 201 com `{ id }` | 204 |
| `GET /api/financeiro/caixinha/{mes}` com mês malformado: 404 | 400 `pedido-invalido` |
| `GET /api/financeiro/comprovante/{id}` e `/nota/{id}` inexistentes: `not-found` | `comprovante-nao-encontrado`, `nota-nao-encontrada` |
| `ativo`, `pendenteEmCentavos` (crédito e pendentes) | `participando`, `pendenciaEmCentavos` |
| `feitoEm` (gasto) | `registradoEm` |
| perfis `gestor` e `participante` | só `gestor` |
| `unauthorized`, `internal-error` | `nao-autenticado`, `erro-interno` |
| `operationId` `obter*` | `consultar*`, como as demais leituras de um recurso só |

## Consequências

Ganhos:

- Quem lê a API acha os termos do glossário e o mesmo status para o mesmo caso, em qualquer contexto.
- O gestor vê o tipo de cota de cada participante.
- O documento público não depende do ambiente.

Custos:

- Mudança incompatível na API pública. Não há cliente além do web e dos testes, que mudam no mesmo PR.
- O *Authorize* do Swagger UI não entra mais com usuário e senha: pede o access token ([gateway/README.md](../../gateway/README.md)).
- As colunas do banco mantêm os nomes antigos (`ativo`, `feito_em`); só o código muda, sem migração.

Riscos:

- Rotas novas precisam seguir as mesmas regras; a revisão do PR confere.
