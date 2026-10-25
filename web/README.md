# FACOFFEE web

Front-end para participantes e gestor (React com Vite). Segue o [Design System](../docs/SYSTEM_DESIGN.md). Decisões em [ADR 0019](../docs/adr/0019-base-do-front-end.md).

Entra pelo Keycloak (OIDC, Authorization Code + PKCE) e chama a API pelo [gateway](../gateway/), em `/api/...`. O menu depende dos perfis de `GET /api/usuario/eu`: todos veem as páginas do participante; o gestor vê também as dele.

```sh
cd infra && docker compose up -d --wait --build   # Keycloak, gateway e serviços
pnpm --filter @facoffee/web dev                   # http://localhost:5173
```

Entre com um usuário de teste do [realm local](../infra/README.md#keycloak) (`gestor`/`gestor` ou `participante`/`participante`). No desenvolvimento, o Vite encaminha `/api` para `https://localhost`.

| Variável | Padrão |
|---|---|
| `VITE_OIDC_AUTHORITY` | `http://localhost:8080/realms/facoffee` |
| `VITE_OIDC_CLIENT_ID` | `facoffee-web` |

| Caminho | Conteúdo |
|---|---|
| `src/estilos.css` | Tokens do Design System e estilos base |
| `src/navegacao.ts` | Menu (e rotas) por perfil |
| `src/api.ts` | Chamadas à API pelo gateway |
| `src/formato.ts` | Valores, meses e datas em português |
| `src/participante.tsx` | Páginas do participante: Minha situação e Caixinha |
| `src/app.tsx` | Login, layout e rotas |
