# 0021. Front-end servido pelo gateway

- Status: Aceito
- Data: 2026-10-25

## Contexto

O [ADR 0019](0019-base-do-front-end.md) deixou um risco em aberto: o FACOFFEE web chama a API em `/api/...`, na mesma origem, e o gateway não tem CORS ([ADR 0007](0007-api-gateway.md)). Só o servidor de desenvolvimento do Vite (`http://localhost:5173`) servia o front-end, encaminhando `/api` ao gateway. A stack do docker compose não tinha o front-end, e não havia como servir o build na mesma origem da API.

Forças em jogo:

- O gateway (Traefik) já é a única porta aberta e já serve uma página pública, o Swagger UI em `/docs` ([ADR 0009](0009-openapi-da-api-publica.md)).
- O Traefik não serve arquivos estáticos.
- O front-end é uma SPA: caminhos como `/caixinha` precisam abrir o `index.html`.
- Rotas internas, como `/api/usuario/contato` e os gatilhos do agendador, respondem 404 no gateway porque não têm rota ([ADR 0017](0017-gatilhos-de-tempo-do-agendador.md), [ADR 0020](0020-envio-de-e-mails-da-notificacao.md)).

## Decisão

- O build do Vite é servido por um container `web` com nginx (`web/Dockerfile`, sem porta publicada), que devolve o `index.html` a todo caminho que não é arquivo do build.
- O gateway encaminha ao `web` todo caminho fora de `/api`, sem token, com a menor prioridade: `/docs` e `/api/<contexto>` continuam com as rotas deles. Caminho em `/api` sem rota continua respondendo 404, e não a página do front-end.
- O front-end fica em `https://localhost/`, na mesma origem da API. O client `facoffee-web` aceita o redirect e o pós-logout `https://localhost/*`.
- O servidor do Vite continua para o desenvolvimento, com recarga a cada mudança.

## Consequências

Ganhos:

- A stack do compose sobe o FACOFFEE inteiro, front-end incluído, sem Node no host.
- O front-end e a API ficam na mesma origem, sem CORS, como em produção.

Custos:

- Mais um container e uma imagem, com build do front-end a cada `--build`.
- Num ambiente que já existia, o Keycloak precisa ser recriado para reimportar o realm com o novo redirect (`docker compose up -d --force-recreate keycloak`).

Riscos:

- O nginx não envia cabeçalhos de segurança (CSP, `X-Frame-Options`) nem de cache; isso fica para antes da produção, junto do certificado ([ADR 0007](0007-api-gateway.md)).
