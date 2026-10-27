# 0023. Teste ponta a ponta com Playwright e Testcontainers

- Status: Aceito; o que o teste faz fora do web substituído por 0033
- Data: 2026-10-25

## Contexto

Os testes de cada serviço param na fronteira do contexto: os de integração publicam e consomem eventos num RabbitMQ real, mas nenhum confere o fluxo inteiro, do clique no web ao e-mail, passando pelo gateway, pelo Keycloak e pelos eventos entre os contextos.

Forças em jogo:

- O login é Authorization Code + PKCE no Keycloak, e o client `facoffee-web` não aceita outro fluxo ([ADR 0019](0019-base-do-front-end.md)).
- O web e os tokens levam os endereços da stack local: o web em `http://localhost` e o Keycloak em `http://localhost:8080`, que o gateway confere no `iss` ([ADR 0007](0007-api-gateway.md)).
- Os eventos chegam aos outros contextos de forma assíncrona: o teste precisa esperar o efeito.
- O gatilho *Todo início de mês* é interno e só o agendador o dispara ([ADR 0017](0017-gatilhos-de-tempo-do-agendador.md)).
- A stack local publica portas fixas e acumula dados, inclusive eventos órfãos dos testes de integração, que rodam contra ela.

## Decisão

- Teste ponta a ponta com [Playwright](https://playwright.dev) (`@playwright/test`, Chromium) em `e2e/`: `pnpm test:e2e`.
- Cada execução sobe uma stack própria com [Testcontainers](https://node.testcontainers.org) (`DockerComposeEnvironment`, no `globalSetup` do Playwright) e a remove no fim, guardando os logs em `test-results/compose.log`.
- A stack é a do [ADR 0003](0003-ambiente-local-docker-compose.md) com `infra/docker-compose.test.yml` por cima, que só muda as portas: os serviços de negócio continuam atrás do gateway; o gateway, o Keycloak e o Mailpit, que o teste usa, ficam em portas aleatórias de `127.0.0.1`; o restante da infra não é publicado. Assim roda ao lado da stack local.
- O Chromium leva `localhost:80` e `localhost:8080` às portas aleatórias (`--host-resolver-rules`), mantendo o `Host`: o web, o login e o `iss` dos tokens não mudam.
- O teste usa o web pelo gateway, com o login pela tela do Keycloak, cada pessoa no seu contexto de navegador. Cada teste cria usuários novos pela API de administração do Keycloak; o gestor é o usuário de teste do realm.
- Fora do web, só o que ele não mostra: o e-mail, pela API do Mailpit; a leitura *Crédito e pendentes* de todos, pela API, com a sessão do gestor; e o *Todo início de mês*, reiniciando o agendador, que dispara os gatilhos ao subir.
- O teste roda só na máquina, quando necessário, e não no CI: cada execução faz o build e sobe a stack inteira, caro demais para cada PR no GitHub Actions. Numa falha, os traces do Playwright e os logs do compose ficam em `test-results/`.

## Consequências

Ganhos:

- O fluxo de eventos é conferido como a pessoa o usa, inclusive gateway, login e e-mail.
- Um comando: stack limpa a cada execução, sem tocar na stack local nem nos seus dados.

Custos:

- Cada execução faz o build das imagens (com cache) e sobe a stack inteira: cerca de 2 minutos.
- O projeto do compose tem nome fixo (`facoffee-e2e`), para reaproveitar as imagens: duas execuções ao mesmo tempo na mesma máquina conflitam.
- O teste depende dos textos e rótulos do web: mudá-los exige ajustar o teste.

Riscos:

- Os testes contam os participantes ativos e por isso rodam em série (`workers: 1`); algo que mude esse número durante a execução (outro teste, o agendador) quebra a conferência do complemento.
