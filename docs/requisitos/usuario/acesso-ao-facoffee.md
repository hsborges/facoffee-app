# RF-USU-01 Acesso ao FACOFFEE

- Contexto: Usuário · Para quem: Gestor e participantes
- Necessidade: Saber quem participa e com qual tipo de cota ([Visão](../../produto/VISAO.md#o-que-o-produto-precisa-garantir)); desativar o acesso de quem saiu
- Termos: [Participante](../../dominio/GLOSSARIO.md#participante), [Gestor](../../dominio/GLOSSARIO.md#gestor)
- Origem: [ADR 0008](../../adr/0008-dados-do-usuario-logado.md), [ADR 0011](../../adr/0011-acesso-desativado.md), [ADR 0012](../../adr/0012-registro-do-usuario-no-primeiro-acesso.md), [ADR 0013](../../adr/0013-reativacao-do-acesso.md)

```gherkin
# language: pt
Funcionalidade: RF-USU-01 Acesso ao FACOFFEE
  Para entrar no FACOFFEE com o Passaporte UFMS,
  como professor ou técnico da FACOM,
  quero ser registrado no primeiro acesso,
  e o gestor desativa ou reativa o acesso de quem saiu.
```

Ter acesso não faz de alguém um participante: participar é pedir a entrada (RF-PAR-01). O acesso desativado encerra a participação (RN-PAR-08).

## Regras

### RN-USU-01 O acesso é desativado pelo gestor ou a pedido da própria pessoa; só o gestor desativa outra

- Termo: [Gestor](../../dominio/GLOSSARIO.md#gestor) · Origem: [ADR 0011](../../adr/0011-acesso-desativado.md)

```gherkin
# language: pt
Regra: RN-USU-01 O acesso é desativado pelo gestor ou a pedido da própria pessoa; só o gestor desativa outra

  Cenário: gestor desativa
    Quando o gestor desativa o acesso de Ana
    Então o acesso de Ana está desativado
    E Usuário desativado é publicado

  Cenário: a própria pessoa desativa
    Quando Ana desativa o próprio acesso
    Então o acesso de Ana está desativado

  Cenário: participante desativa outro
    Quando Ana, participante, desativa o acesso de Bia
    Então o pedido é recusado
```

### RN-USU-02 Quem está desativado não acessa o FACOFFEE

- Origem: [ADR 0011](../../adr/0011-acesso-desativado.md)

```gherkin
# language: pt
Regra: RN-USU-02 Quem está desativado não acessa o FACOFFEE

  Cenário: acesso barrado
    Dado que o acesso de Ana está desativado
    Quando Ana abre o FACOFFEE
    Então nenhum pedido de Ana passa do gateway
```

### RN-USU-03 Desativar de novo não publica outra vez

- Origem: [ADR 0011](../../adr/0011-acesso-desativado.md)

```gherkin
# language: pt
Regra: RN-USU-03 Desativar de novo não publica outra vez

  Cenário: já desativado
    Dado que o acesso de Ana está desativado
    Quando o gestor desativa o acesso de Ana de novo
    Então Usuário desativado não é publicado de novo
```

### RN-USU-04 Só o gestor reativa o acesso, e reativar não devolve a participação

- Termo: [Gestor](../../dominio/GLOSSARIO.md#gestor) · Origem: [ADR 0013](../../adr/0013-reativacao-do-acesso.md)

Para voltar a participar, a pessoa pede a entrada de novo (RN-PAR-03).

```gherkin
# language: pt
Regra: RN-USU-04 Só o gestor reativa o acesso, e reativar não devolve a participação

  Cenário: gestor reativa
    Dado que o acesso de Ana está desativado
    Quando o gestor reativa o acesso de Ana
    Então Ana volta a acessar o FACOFFEE
    E Ana ainda não participa da copa

  Cenário: a própria pessoa tenta reativar
    Quando Ana reativa o próprio acesso
    Então o pedido é recusado
```

### RN-USU-05 O usuário é registrado no primeiro acesso, com nome, e-mail e perfis atualizados a cada acesso

- Origem: [ADR 0012](../../adr/0012-registro-do-usuario-no-primeiro-acesso.md), [ADR 0031](../../adr/0031-avisos-do-comprovante-enviado.md)

Nome, e-mail e perfis ficam só em Usuário; Notificação os consulta para avisar (RF-NOT-01).

```gherkin
# language: pt
Regra: RN-USU-05 O usuário é registrado no primeiro acesso, com nome, e-mail e perfis atualizados a cada acesso

  Cenário: primeiro acesso
    Quando Ana acessa o FACOFFEE pela primeira vez
    Então Ana fica registrada com o nome, o e-mail e os perfis do Passaporte UFMS

  Cenário: acesso seguinte com dados novos
    Dado que Ana está registrada
    Quando Ana acessa com outro e-mail e o perfil de gestora
    Então o registro de Ana é atualizado
```

### RN-USU-06 Só o gestor lista os usuários

- Termo: [Gestor](../../dominio/GLOSSARIO.md#gestor) · Origem: [ADR 0012](../../adr/0012-registro-do-usuario-no-primeiro-acesso.md)

```gherkin
# language: pt
Regra: RN-USU-06 Só o gestor lista os usuários

  Cenário: participante tenta listar
    Quando Ana, participante, lista os usuários
    Então o pedido é recusado
```
