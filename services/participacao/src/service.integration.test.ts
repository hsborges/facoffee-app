// Needs the local compose: cd infra && docker compose up -d --wait postgres rabbitmq
import { randomInt, randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import amqplib from 'amqplib';
import pg from 'pg';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
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
  post('/entrada', { 'x-user-id': id }, { tipoDeCota });
const sair = (id: string) => post('/saida', { 'x-user-id': id });
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
});

it('saves a troca de tipo de cota for the next month and publishes nothing', async () => {
  const id = randomUUID();
  await entrar(id, 'so-cafe');

  const troca = post('/troca-cota', { 'x-user-id': id }, { tipoDeCota: 'completa' });
  expect((await troca).status).toBe(204);

  const { rows } = await db.query(
    'select tipo_de_cota, troca_tipo_de_cota, troca_a_partir_de from participantes where id = $1',
    [id],
  );
  expect(rows).toMatchObject([{ tipo_de_cota: 'so-cafe', troca_tipo_de_cota: 'completa' }]);
  expect(rows[0].troca_a_partir_de).toMatch(/^\d{4}-\d{2}$/);
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

  expect((await post('/valor-da-cota', participante, valor)).status).toBe(403);
  expect((await post('/valor-da-cota', gestor, valor)).status).toBe(204);
  expect((await post('/valor-da-cota', gestor, { ...valor, valorEmCentavos: 3000 })).status).toBe(
    409,
  );

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
