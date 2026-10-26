# 0025. Dockerfile por serviço

- Status: Aceito
- Data: 2026-10-26

## Contexto

O [ADR 0005](0005-template-de-servico.md) definiu o template como pasta copiável, mas o compose construía todos os serviços (e o `gateway-auth`) a partir de `templates/service/Dockerfile`, mudando só o `ARG PACKAGE`. Uma mudança no template mudava a imagem de todos, e nenhum serviço ajustava a própria imagem sem afetar os outros. O mesmo ADR, em *Ambiente local*, pôs o serviço `example` no compose para comprovar publicação e consumo de eventos; hoje os serviços reais e o teste de integração do template já comprovam isso.

Os Dockerfiles faziam `COPY . .` antes do `pnpm install`: qualquer arquivo alterado no monorepo reinstalava e recompilava todas as imagens a cada `docker compose up --build`, inclusive no teste ponta a ponta ([ADR 0023](0023-teste-ponta-a-ponta-com-playwright.md)).

## Decisão

Substitui o ADR 0005. Tudo o que ele decidiu continua valendo, exceto:

- **Dockerfile por serviço**: cada serviço tem o próprio `Dockerfile` na sua pasta (`services/<contexto>/Dockerfile`, `gateway/Dockerfile`), com o nome do pacote fixo. `templates/service/Dockerfile` é só o modelo a copiar.
- **Ambiente local**: o serviço `example` sai do compose. O banco `example` continua, usado pelo teste de integração do template.
- **Build em camadas**: manifestos da raiz e `pnpm fetch`, depois o `package.json` do pacote e `pnpm install`, por fim o código do pacote e o build. Cada imagem copia só a própria pasta e `tsconfig.base.json` (o web também copia o logo e as fontes do tema do Keycloak). O store do pnpm fica num cache mount do BuildKit compartilhado entre as imagens. Vale também para `web/Dockerfile`.

## Consequências

Ganhos:

- Cada serviço controla a própria imagem.
- Mudar o código de um serviço reconstrói só a imagem dele, a partir do build; mudar docs, testes ou outro pacote não invalida nada. Mudança de dependência reaproveita o store.

Custos:

- Os Dockerfiles ficam copiados em cada serviço; uma melhoria precisa ser repetida em todas as cópias.
- O template não roda mais no compose; para vê-lo de pé, é preciso subi-lo à mão.

Riscos:

- Um pacote que passar a depender de outro do workspace precisa copiar a pasta dele no próprio `Dockerfile`.
