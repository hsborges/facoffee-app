# 0002. Stack TypeScript/Node.js

- Status: Proposto
- Data: 2026-10-24

## Contexto

O [ADR 0001](0001-arquitetura-servicos.md) definiu uma arquitetura baseada em serviços: um serviço por contexto, um banco por serviço, eventos via RabbitMQ, API Gateway na rede pública e armazenamento de arquivos para comprovantes e notas. A linguagem já é TypeScript em Node.js 24. Falta escolher as bibliotecas e ferramentas antes do template de serviço.

Forças em jogo:

- O [AGENTS.md](../../AGENTS.md) pede estilo funcional: funções puras, tipos e uniões discriminadas, classes só quando um framework exigir.
- Todos os serviços devem usar a mesma stack, gerada a partir de um template.
- Equipe pequena: poucas peças, ferramentas leves e com boa integração com TypeScript.
- Os contratos de eventos são API pública entre contextos e seguem SemVer.

## Decisão

| Tema | Escolha |
|---|---|
| Linguagem e runtime | TypeScript (modo `strict`), Node.js 24, ESM |
| Framework HTTP | [Hono](https://hono.dev) com `@hono/node-server` |
| Banco de dados | PostgreSQL, uma instância (ou banco) por serviço |
| ORM e migrations | [Drizzle ORM](https://orm.drizzle.team) e `drizzle-kit` |
| Cliente RabbitMQ | `amqplib` com `amqp-connection-manager` |
| Testes | [Vitest](https://vitest.dev) |
| Lint e formatação | [Biome](https://biomejs.dev) |
| Pacotes e workspaces | pnpm workspaces (monorepo) |
| API Gateway | [Traefik](https://traefik.io) |
| Armazenamento de arquivos | API S3; [SeaweedFS](https://github.com/seaweedfs/seaweedfs) no ambiente local |
| Front-end | React com Vite (SPA) |
| Contratos de eventos | JSON Schema por evento e versão; [AsyncAPI](https://www.asyncapi.com) para canais, publicadores e consumidores |

**Serviços**

- Hono: rotas são funções, sem classes nem decorators; segue Web Standards (`Request`/`Response`).
- Drizzle: schema em TypeScript, consultas próximas de SQL, sem geração de código. Cada serviço tem o próprio schema e as próprias migrations.
- `amqp-connection-manager`: reconexão automática e *publisher confirms* sobre o `amqplib`.
- Arquivos acessados pelo SDK S3 (`@aws-sdk/client-s3`); o código não depende de SeaweedFS. MinIO foi descartado por não estar mais disponível.

**Ferramentas**

- Vitest para testes de unidade e integração, nativo em TypeScript/ESM.
- Biome substitui ESLint e Prettier: uma ferramenta, uma configuração na raiz.
- pnpm com dependências estritas: um pacote só importa o que declara, o que impede imports acidentais entre serviços.

**Gateway**

- Traefik faz TLS e roteamento para Usuário, Participação e Financeiro, configurado pelo docker compose.
- O token OIDC é validado no gateway por middleware (ex.: ForwardAuth); o detalhe fica na issue do API Gateway.
- O gateway não compõe respostas.

**Contratos**

- Em `contracts/events/`, um JSON Schema por evento e versão major.
- Um documento AsyncAPI descreve exchanges, filas, quem publica e quem consome.
- Os tipos TypeScript dos eventos são gerados ou validados a partir dos schemas, não escritos à mão em cada serviço.

## Consequências

Ganhos:

- Stack leve e funcional, alinhada ao estilo do AGENTS.md.
- Uma linguagem do banco ao front-end; um template serve a todos os serviços.
- Contratos neutros de linguagem e documentados, aptos a versionamento SemVer.
- Armazenamento de arquivos portável para qualquer provedor S3.

Custos:

- Hono e Drizzle são menos opinativos que NestJS e Prisma: estrutura de pastas, injeção de dependências e tratamento de erros ficam a cargo do template.
- Biome tem menos regras e plugins que o ESLint.
- Manter JSON Schema e AsyncAPI exige gerar ou validar os tipos TypeScript a partir deles.

Riscos:

- Sem composição no gateway, leituras que cruzam contextos precisam de leituras próprias em cada serviço ou de composição no front-end.
- Validação de token no Traefik depende de middleware externo; se ficar complexa, os serviços podem validar o JWT com a mesma biblioteca do template.
