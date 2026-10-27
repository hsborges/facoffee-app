# FACOFFEE web

Front-end para participantes e gestor (React com Vite). Segue o [Design System](../docs/design/DESIGN_SYSTEM.md). Decisões em [ADR 0019](../docs/adr/0019-base-do-front-end.md).

Quem não está logado vê a página inicial, com o botão **Entrar** ([ADR 0025](../docs/adr/0025-pagina-inicial-antes-do-login.md)). Entra pelo Keycloak (OIDC, Authorization Code + PKCE) e chama a API pelo [gateway](../gateway/), em `/api/...`. O menu depende dos perfis de `GET /api/usuario/eu`: quem não é gestor vê as páginas do participante; o gestor escolhe, ao entrar, a visão do gestor ou a do participante e troca pelo menu da conta, no avatar ([ADR 0029](../docs/adr/0029-visoes-do-gestor-e-do-participante.md)). O menu fica no pé da tela no celular e na lateral a partir de `48rem`; as tarefas longas são subpáginas da página de onde saem ([ADR 0034](../docs/adr/0034-menu-inferior-no-celular-e-lateral-no-computador.md)). As telas seguem o [protótipo](../docs/design/PROTOTYPE.md).

```sh
cd infra && docker compose up -d --wait --build   # stack completa; o web fica em https://localhost
pnpm --filter @facoffee/web dev                   # desenvolvimento: http://localhost:5173
```

Entre com um usuário de teste do [realm local](../infra/README.md#keycloak) (`gestor`/`gestor` ou `participante`/`participante`). No desenvolvimento, o Vite encaminha `/api` para `https://localhost`. Na stack, o build é servido por nginx (`Dockerfile`, `nginx.conf`) atrás do gateway ([ADR 0021](../docs/adr/0021-front-end-servido-pelo-gateway.md)).

| Variável | Padrão |
|---|---|
| `VITE_OIDC_AUTHORITY` | `http://localhost:8080/realms/facoffee` |
| `VITE_OIDC_CLIENT_ID` | `facoffee-web` |

| Caminho | Conteúdo |
|---|---|
| `src/estilos.css` | Tokens do Design System e estilos base |
| `src/navegacao.ts` | Menu, páginas e subpáginas de cada visão |
| `src/icones.tsx` | Ícones de traço do Design System |
| `src/api.ts` | Chamadas à API pelo gateway |
| `src/formato.ts` | Valores, meses e datas em português |
| `src/inicial.tsx` | Página inicial de quem não está logado |
| `src/participante.tsx` | Páginas do participante: Minha situação, Enviar comprovante e Caixinha; e os componentes que o gestor também usa |
| `src/gestor.tsx` | Páginas do gestor: Participantes, Conferir comprovante, Receber pagamento, Gastos, Solicitar complemento e Valor da cota; e Registrar gasto, das duas visões |
| `src/app.tsx` | Login, layout e rotas |
