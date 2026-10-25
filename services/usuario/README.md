# Usuário

Contexto de negócio. Acesso das pessoas ao FACOFFEE, autenticadas pelo Passaporte UFMS (Keycloak, OIDC).

- **Publica:** Usuário desativado
- **Consome:** —

## API

Alcançada só pelo [gateway](../../gateway/), que valida o token e envia a identidade nos headers `X-User-*` ([ADR 0008](../../docs/adr/0008-dados-do-usuario-logado.md)).

| Rota pública | Resposta |
|---|---|
| `GET /api/usuario` | Usuários registrados, com quem está desativado: `[{ id, nome, email, desativado }]`, ou 403 se não é gestor |
| `GET /api/usuario/eu` | Usuário logado: `{ id, nome, email, perfis }` |
| `POST /api/usuario/<id>/desativar` | Desativa o acesso e publica *Usuário desativado*: 204, ou 403 se não é gestor nem o próprio usuário |
| `POST /api/usuario/<id>/reativar` | Reativa o acesso, sem publicar evento: 204, ou 403 se não é gestor ([ADR 0013](../../docs/adr/0013-reativacao-do-acesso.md)) |

O gateway chama `GET /acesso` antes de toda requisição, de qualquer contexto: registra o usuário (ou atualiza nome e e-mail) e responde 204 se o acesso está ativo, 403 se foi desativado ([ADR 0011](../../docs/adr/0011-acesso-desativado.md), [ADR 0012](../../docs/adr/0012-registro-do-usuario-no-primeiro-acesso.md)).

Notificação chama `GET /contato/<id>`, rota interna sem identidade e fora do gateway: responde `{ id, nome, email }` de um usuário registrado, ou 404, para os avisos por e-mail. Com `X-User-Id`, que o gateway sempre envia, responde 404 ([ADR 0020](../../docs/adr/0020-envio-de-e-mails-da-notificacao.md)).

Especificação completa em [`gateway/openapi.yaml`](../../gateway/openapi.yaml).

Perfis de acesso: `gestor` e `participante`, papéis do realm no Keycloak. Os demais papéis do token são ignorados.

Banco, outbox e publicação vêm do [template de serviço](../../templates/service/); sem consumidor. A tabela `usuarios` guarda id, nome e e-mail de quem já acessou; `usuarios_desativados`, quem teve o acesso desativado.

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
