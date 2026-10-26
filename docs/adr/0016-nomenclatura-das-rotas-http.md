# 0016. Nomenclatura das rotas HTTP

- Status: Aceito
- Data: 2026-10-25

## Contexto

Não havia regra escrita para nomear rotas, e cada contexto decidiu do seu jeito. As rotas de comando usavam substantivos (`desativacao`, `reativacao`, `entrada`, `troca-cota`, `saida`, `valor-da-cota`), enquanto a linguagem ubíqua nomeia os comandos com verbos ("Desativar acesso", "Trocar tipo de cota", "Definir valor da cota"). Com o substantivo, a rota não diz o que o comando faz, e `troca-cota` ainda usa "cota" no sentido de tipo de cota, que o [glossário](../dominio/GLOSSARIO.md#cota) evita.

## Decisão

Regras para rotas HTTP públicas:

- Em português, minúsculas, kebab-case, sem acento.
- Recursos (leituras) são substantivos no singular: `GET /api/usuario`, `GET /api/usuario/eu`.
- Comandos são `POST` com um verbo no infinitivo, em voz ativa, como sub-recurso: `POST /api/<contexto>/{id}/<verbo>` quando agem sobre um recurso identificado, ou `POST /api/<contexto>/<verbo>` quando agem sobre o usuário logado.
- O verbo, e o complemento quando houver, vem da linguagem ubíqua ([docs/dominio/GLOSSARIO.md](../dominio/GLOSSARIO.md)).
- Eventos continuam no passado e em inglês ([ADR 0006](0006-contratos-dos-eventos-em-ingles.md)); a regra vale só para rotas HTTP.

Rotas renomeadas, sem manter os caminhos antigos (passam a responder 404):

| Antes | Agora |
|---|---|
| `POST /api/usuario/{id}/desativacao` ([ADR 0011](0011-acesso-desativado.md)) | `POST /api/usuario/{id}/desativar` |
| `POST /api/usuario/{id}/reativacao` ([ADR 0013](0013-reativacao-do-acesso.md)) | `POST /api/usuario/{id}/reativar` |
| `POST /api/participacao/entrada` | `POST /api/participacao/entrar` |
| `POST /api/participacao/troca-cota` | `POST /api/participacao/trocar-tipo-de-cota` |
| `POST /api/participacao/saida` | `POST /api/participacao/sair` |
| `POST /api/participacao/valor-da-cota` | `POST /api/participacao/definir-valor-da-cota` |

## Consequências

Ganhos:

- A rota diz o que o comando faz, com as mesmas palavras do glossário e dos casos de uso.
- Um só padrão para todos os contextos, inclusive os que ainda vão surgir (Financeiro).

Custos:

- Mudança incompatível na API pública: clientes dos caminhos antigos precisam migrar. Ainda não há cliente além dos testes.
- Os caminhos citados nos ADRs 0011 e 0013 ficam desatualizados; vale o desta tabela.

Riscos:

- Comandos sem verbo claro na linguagem ubíqua forçam escolher um; nesse caso, o termo entra no glossário primeiro.
