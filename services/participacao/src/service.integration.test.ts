// Needs the local compose: cd infra && docker compose -f docker-compose.dev.yml up -d --wait postgres rabbitmq
import { randomInt, randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import amqplib from 'amqplib';
import pg from 'pg';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { anoDe, mesDe } from './domain/calendario.js';
import { queues } from './infra/consumer.js';
import { createLogger } from './infra/logger.js';
import { EXCHANGE } from './infra/rabbitmq.js';
import { startService } from './service.js';

const config = {
  // Unique queue names so the test does not compete with a running participacao container.
  service: `test-${randomUUID().slice(0, 8)}`,
  port: 0,
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://participacao:participacao@localhost:5432/participacao',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://facoffee:facoffee@localhost:5672',
};
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

type Received = { type: string; payload: Record<string, unknown> };

const amqp = await amqplib.connect(config.rabbitmqUrl);
const channel = await amqp.createChannel();
await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
const { queue } = await channel.assertQueue('', { exclusive: true });
await channel.bindQueue(queue, EXCHANGE, 'participation.#');
const received: Received[] = [];
await channel.consume(queue, (msg) => msg && received.push(JSON.parse(msg.content.toString())), {
  noAck: true,
});

const running = await startService(
  config,
  createLogger('test', () => {}),
);
const url = `http://127.0.0.1:${running.port}`;

const db = new pg.Pool({ connectionString: config.databaseUrl });

beforeAll(() => running.ready());

afterAll(async () => {
  await running.stop();
  for (const name of Object.values(queues(config.service))) await channel.deleteQueue(name);
  await amqp.close();
  await db.end();
});

const eventually = async (check: () => boolean, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!check() && Date.now() < deadline) await sleep(100);
  return check();
};

const post = (path: string, headers: Record<string, string>, body: unknown = {}) =>
  fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
const entrar = (id: string, tipoDeCota: string) =>
  post('/entrar', { 'x-user-id': id }, { tipoDeCota });
const sair = (id: string) => post('/sair', { 'x-user-id': id });
const eventos = (type: string, id: string) =>
  received.filter((e) => e.type === type && e.payload.participantId === id);
const joined = (id: string) => eventos('participation.participant-joined', id);
const left = (id: string) => eventos('participation.participant-left', id);

it('publishes Participante entrou once and refuses entering while participando', async () => {
  const id = randomUUID();

  expect((await entrar(id, 'so-cafe')).status).toBe(204);
  expect((await entrar(id, 'completa')).status).toBe(409);

  expect(await eventually(() => joined(id).length > 0)).toBe(true);
  await sleep(1000);
  expect(joined(id)).toMatchObject([{ type: 'participation.participant-joined', version: 1 }]);
});

it('publishes Participante saiu once, and Participante entrou again when the participante returns', async () => {
  const id = randomUUID();

  expect((await entrar(id, 'so-cafe')).status).toBe(204);
  expect((await sair(id)).status).toBe(204);
  expect((await sair(id)).status).toBe(409);
  expect((await entrar(id, 'completa')).status).toBe(204);

  expect(await eventually(() => joined(id).length === 2 && left(id).length === 1)).toBe(true);
  const { rows } = await db.query('select tipo_de_cota from participantes where id = $1', [id]);
  expect(rows).toEqual([{ tipo_de_cota: 'completa' }]);
  const lista = await fetch(`${url}/participante`, {
    headers: { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' },
  });
  expect(((await lista.json()) as { id: string }[]).find((p) => p.id === id)).toEqual({
    id,
    tipoDeCota: 'completa',
    participando: true,
    troca: null,
  });
});

it('saves a troca de tipo de cota for the next month and publishes nothing', async () => {
  const id = randomUUID();
  await entrar(id, 'so-cafe');

  const troca = post('/trocar-tipo-de-cota', { 'x-user-id': id }, { tipoDeCota: 'completa' });
  expect((await troca).status).toBe(204);

  const { rows } = await db.query(
    'select tipo_de_cota, troca_tipo_de_cota, troca_a_partir_de from participantes where id = $1',
    [id],
  );
  expect(rows).toMatchObject([{ tipo_de_cota: 'so-cafe', troca_tipo_de_cota: 'completa' }]);
  expect(rows[0].troca_a_partir_de).toMatch(/^\d{4}-\d{2}$/);

  const eu = await fetch(`${url}/participante/eu`, { headers: { 'x-user-id': id } });
  expect(await eu.json()).toEqual({
    id,
    tipoDeCota: 'so-cafe',
    participando: true,
    troca: { tipoDeCota: 'completa', aPartirDe: rows[0].troca_a_partir_de },
  });
});

it('turns Usuário desativado into Participante saiu once, even after a saída or a redelivery', async () => {
  const [ativo, saiu, nunca] = [randomUUID(), randomUUID(), randomUUID()];
  await entrar(ativo, 'completa');
  await entrar(saiu, 'completa');
  await sair(saiu);

  const desativado = (userId: string) => ({
    id: randomUUID(),
    type: 'user.user-deactivated',
    version: 1,
    occurredAt: new Date().toISOString(),
    payload: { userId },
  });
  const ativoDesativado = desativado(ativo);
  for (const event of [ativoDesativado, ativoDesativado, desativado(saiu), desativado(nunca)]) {
    channel.publish(EXCHANGE, 'user.user-deactivated.v1', Buffer.from(JSON.stringify(event)));
  }

  expect(await eventually(() => left(ativo).length > 0)).toBe(true);
  await sleep(1500);
  expect([left(ativo).length, left(saiu).length, left(nunca).length]).toEqual([1, 1, 0]);
});

it('publishes Valor da cota definido once and only for the gestor', async () => {
  // A random future year keeps reruns from colliding with valores already defined.
  const valor = { tipoDeCota: 'so-cafe', ano: 3000 + randomInt(1_000_000), valorEmCentavos: 2500 };
  const gestor = { 'x-user-id': randomUUID(), 'x-user-roles': 'participante,gestor' };
  const participante = { 'x-user-id': randomUUID(), 'x-user-roles': 'participante' };

  expect((await post('/definir-valor-da-cota', participante, valor)).status).toBe(403);
  expect((await post('/definir-valor-da-cota', gestor, valor)).status).toBe(204);
  expect(
    (await post('/definir-valor-da-cota', gestor, { ...valor, valorEmCentavos: 3000 })).status,
  ).toBe(409);

  const definidos = () =>
    received.filter(
      (e) => e.type === 'participation.contribution-amount-set' && e.payload.year === valor.ano,
    );
  expect(await eventually(() => definidos().length > 0)).toBe(true);
  await sleep(1000);
  expect(definidos()).toMatchObject([
    { payload: { contributionType: 'coffee-only', year: valor.ano, amountInCents: 2500 } },
  ]);
});

it('the agendador triggers make the cota of the month devida once for each participante ativo', async () => {
  const agora = new Date();
  await db.query(
    `insert into valores_da_cota values ('so-cafe', $1, 2500), ('completa', $1, 3000)
     on conflict do nothing`,
    [anoDe(agora)],
  );
  const { rows } = await db.query(
    `select valor_em_centavos from valores_da_cota where tipo_de_cota = 'completa' and ano = $1`,
    [anoDe(agora)],
  );
  const [ativo, saiu] = [randomUUID(), randomUUID()];
  await entrar(ativo, 'completa');
  await entrar(saiu, 'so-cafe');
  await sair(saiu);

  expect((await post('/iniciar-ano', {})).status).toBe(200);
  const disparos = await Promise.all([post('/iniciar-mes', {}), post('/iniciar-mes', {})]);
  expect(disparos.map((r) => r.status)).toEqual([200, 200]);
  expect(await (await post('/iniciar-mes', {})).json()).toMatchObject({ cotasDevidas: 0 });

  const devidas = (id: string) => eventos('participation.contribution-due', id);
  expect(await eventually(() => devidas(ativo).length > 0)).toBe(true);
  await sleep(1000);
  expect(devidas(saiu)).toEqual([]);
  expect(devidas(ativo)).toMatchObject([
    {
      version: 1,
      payload: {
        month: mesDe(agora),
        contributionType: 'full',
        amountInCents: rows[0].valor_em_centavos,
      },
    },
  ]);
});

it('gives anyone logged in the valor of each tipo de cota in the current year', async () => {
  const ano = anoDe(new Date());
  await db.query(
    `insert into valores_da_cota values ('so-cafe', $1, 2500), ('completa', $1, 3000)
     on conflict do nothing`,
    [ano],
  );
  const { rows } = await db.query(
    `select tipo_de_cota as "tipoDeCota", ano, valor_em_centavos as "valorEmCentavos"
     from valores_da_cota where ano = $1`,
    [ano],
  );

  const response = await fetch(`${url}/valor-da-cota`, { headers: { 'x-user-id': randomUUID() } });
  expect(response.status).toBe(200);
  expect(new Set(await response.json())).toEqual(new Set(rows));
});

it('concurrent requests publish Participante saiu and Valor da cota definido once', async () => {
  const id = randomUUID();
  await entrar(id, 'completa');
  const saidas = await Promise.all([sair(id), sair(id), sair(id)]);
  expect(saidas.map((r) => r.status).sort()).toEqual([204, 409, 409]);

  const valor = { tipoDeCota: 'completa', ano: 3000 + randomInt(1_000_000), valorEmCentavos: 3000 };
  const gestor = { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' };
  const definicoes = await Promise.all(
    [1, 2, 3].map(() => post('/definir-valor-da-cota', gestor, valor)),
  );
  expect(definicoes.map((r) => r.status).sort()).toEqual([204, 409, 409]);

  const definidos = () =>
    received.filter(
      (e) => e.type === 'participation.contribution-amount-set' && e.payload.year === valor.ano,
    );
  expect(await eventually(() => left(id).length > 0 && definidos().length > 0)).toBe(true);
  await sleep(1000);
  expect([left(id).length, definidos().length]).toEqual([1, 1]);
});
