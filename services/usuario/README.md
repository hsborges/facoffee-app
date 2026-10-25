# Usuário

Contexto de negócio. Acesso das pessoas ao FACOFFEE, autenticadas pelo Passaporte UFMS (Keycloak, OIDC).

- **Publica:** Usuário desativado
- **Consome:** —

## API

Alcançada só pelo [gateway](../../gateway/), que valida o token e envia a identidade nos headers `X-User-*` ([ADR 0008](../../docs/adr/0008-dados-do-usuario-logado.md)).

| Rota pública | Resposta |
|---|---|
| `GET /api/usuario/eu` | Usuário logado: `{ id, nome, email, perfis }` |

Perfis de acesso: `gestor` e `participante`, papéis do realm no Keycloak. Os demais papéis do token são ignorados.

Ainda sem banco nem mensageria; quando o serviço publicar *Usuário desativado*, o que falta vem do [template de serviço](../../templates/service/).

## Comandos

```sh
pnpm --filter @facoffee/usuario test
cd infra && docker compose up -d --wait --build usuario gateway
curl -k https://localhost/api/usuario/eu -H "Authorization: Bearer $TOKEN"
```
