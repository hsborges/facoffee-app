# Usuário

Contexto de negócio. Acesso das pessoas ao FACOFFEE, autenticadas pelo Passaporte UFMS (Keycloak, OIDC).

- **Publica:** Usuário desativado
- **Consome:** —

## API

Alcançada só pelo [gateway](../../gateway/), que valida o token e envia a identidade nos headers `X-User-*` ([ADR 0008](../../docs/adr/0008-dados-do-usuario-logado.md)).

| Rota pública | Resposta |
|---|---|
| `GET /api/usuario/eu` | Usuário logado: `{ id, nome, email, perfis }` |
| `POST /api/usuario/<id>/desativacao` | Desativa o acesso e publica *Usuário desativado*: 204, ou 403 se não é gestor nem o próprio usuário |

O gateway chama `GET /acesso` antes de toda requisição, de qualquer contexto: 204 se o acesso está ativo, 403 se foi desativado ([ADR 0011](../../docs/adr/0011-acesso-desativado.md)).

Especificação completa em [`gateway/openapi.yaml`](../../gateway/openapi.yaml).

Perfis de acesso: `gestor` e `participante`, papéis do realm no Keycloak. Os demais papéis do token são ignorados.

Banco, outbox e publicação vêm do [template de serviço](../../templates/service/); sem consumidor. A tabela `usuarios_desativados` guarda quem teve o acesso desativado.

## Configuração

| Variável | Exemplo |
|---|---|
| `SERVICE` | `user` (nome do contexto nos contratos) |
| `PORT` | `3000` (padrão) |
| `DATABASE_URL` | `postgres://usuario:usuario@localhost:5432/usuario` |
| `RABBITMQ_URL` | `amqp://facoffee:facoffee@localhost:5672` |

## Comandos

```sh
pnpm --filter @facoffee/usuario test               # unidade
pnpm --filter @facoffee/usuario test:integration   # precisa de postgres e rabbitmq do compose
pnpm --filter @facoffee/usuario db:generate        # gera migration após mudar src/infra/db/schema.ts
cd infra && docker compose up -d --wait --build usuario gateway
curl -k https://localhost/api/usuario/eu -H "Authorization: Bearer $TOKEN"
```
