# 0018. Armazenamento de comprovantes e notas

- Status: Aceito
- Data: 2026-10-25

## Contexto

O [ADR 0001](0001-arquitetura-servicos.md) põe em Financeiro a guarda de comprovantes e notas em armazenamento de arquivos, e o [ADR 0002](0002-stack.md) escolhe a API S3 (SeaweedFS no ambiente local). A [issue #19](https://github.com/hsborges/facoffee-app/issues/19) pede upload e download desses arquivos, com limite de tamanho e de tipos, e que o participante só veja os próprios comprovantes.

Forças em jogo:

- Só o gestor recebe pagamentos ([issue #20](https://github.com/hsborges/facoffee-app/issues/20)); o comprovante é enviado por ele, mas pertence ao participante que pagou.
- A nota é de um gasto da caixinha, que é de todos; qualquer participante pode ter pago um gasto e guardado a nota.
- Pagamento e Gasto ainda não existem; o arquivo precisa ser guardado antes do comando que o usa.
- O tipo declarado pelo cliente (`Content-Type`, extensão) não é confiável.

## Decisão

**Rotas** (seguem o [ADR 0016](0016-nomenclatura-das-rotas-http.md)), com `multipart/form-data` e campo `arquivo`:

| Rota | Quem | Resposta |
|---|---|---|
| `POST /api/financeiro/guardar-comprovante` (com `participanteId`) | só o gestor | `201 { id }` |
| `POST /api/financeiro/guardar-nota` | qualquer participante | `201 { id }` |
| `GET /api/financeiro/comprovante/{id}` | o participante do comprovante e o gestor | o arquivo |
| `GET /api/financeiro/nota/{id}` | qualquer participante | o arquivo |

Os comandos de receber pagamento e registrar gasto passam a referenciar o `id` devolvido.

**Limites**: até 5 MB; só PDF, JPEG e PNG, reconhecidos pelos primeiros bytes do conteúdo. O tipo guardado e servido é o reconhecido, nunca o declarado, e o download vai com `X-Content-Type-Options: nosniff`. O corpo acima do limite é recusado (413) antes de ser lido inteiro.

**Acesso**: sem identidade do gateway, 401. Um comprovante de outro participante responde 404, como um id que não existe, para não revelar que ele existe.

**Armazenamento**: um bucket (`S3_BUCKET`), criado no startup se não existir, com chaves `comprovante/<id>` e `nota/<id>`. O participante do comprovante fica nos metadados do objeto; não há tabela no banco. O bucket é privado (credenciais S3) e fica na rede interna; o arquivo só sai pelo serviço. O `/health` passa a conferir o bucket.

## Consequências

Ganhos:

- Upload e download prontos antes de Pagamento e Gasto, que só guardam o `id`.
- Controle de acesso sem banco: arquivo e dono ficam juntos.
- Um arquivo com conteúdo de outro tipo (HTML, script) não é aceito nem servido como tal.

Custos:

- O arquivo inteiro passa pela memória do serviço no upload e no download (até 5 MB por pedido).
- Financeiro passa a depender do S3 para subir e para estar saudável.

Riscos:

- Arquivos guardados e nunca usados por um pagamento ou gasto ficam no bucket sem limpeza.
- Quem tem as credenciais S3 lê qualquer arquivo; elas ficam só no serviço Financeiro.
- O participante do comprovante é o informado pelo gestor; Financeiro não confere se ele existe.
