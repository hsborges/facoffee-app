# 0015. Fuso horário do domínio

- Status: Aceito
- Data: 2026-10-25

## Contexto

Regras de Participação dependem do mês e do ano: a troca de tipo de cota só vale a partir do mês seguinte, o valor da cota vale para um ano e a cota é devida no início de cada mês. Os instantes são guardados e trocados em UTC (`occurredAt`, `timestamptz`), mas o mês em UTC vira às 20h ou 21h do dia anterior para quem está na copa: uma troca pedida em 31 de outubro às 22h cairia em novembro e só valeria em dezembro.

Forças em jogo:

- A copa fica na FACOM, em Campo Grande (MS), UTC-4, sem horário de verão desde 2019.
- O agendador ([issue #17](https://github.com/hsborges/facoffee-app/issues/17)) e o Financeiro também vão falar de meses.

## Decisão

- Meses e anos do domínio viram à meia-noite de `America/Campo_Grande`.
- Instantes continuam em UTC; só a conversão para mês (`AAAA-MM`) e ano usa o fuso, com `Intl.DateTimeFormat`, sem dependência nova.
- Em Participação, a conversão fica em `services/participacao/src/domain/calendario.ts`.

## Consequências

Ganhos:

- O mês que a pessoa vê no calendário é o mesmo das regras, qualquer que seja o fuso do servidor.
- Usar o nome IANA, não um deslocamento fixo, acompanha uma eventual volta do horário de verão.

Custos:

- Todo contexto que calcular meses precisa usar o mesmo fuso.

Riscos:

- Uma imagem Node sem dados completos de fuso (ICU reduzido) quebraria a conversão; as imagens oficiais do Node trazem o ICU completo.
