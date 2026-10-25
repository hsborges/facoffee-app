// Needs the local compose: cd infra && docker compose up -d --wait postgres rabbitmq
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import amqplib from 'amqplib';
import pg from 'pg';
import { afterAll, expect, it, vi } from 'vitest';
import { createLogger } from './infra/logger.js';
import { EXCHANGE } from './infra/rabbitmq.js';
import { startService } from './service.js';

const config = {
  service: 'participation',
  port: 0,
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://participacao:participacao@localhost:5432/participacao',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://facoffee:facoffee@localhost:5672',
};
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const amqp = await amqplib.connect(config.rabbitmqUrl);
const channel = await amqp.createChannel();
await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
const { queue } = await channel.assertQueue('', { exclusive: true });
await channel.bindQueue(queue, EXCHANGE, 'participation.participant-joined.v1');
const received: unknown[] = [];
await channel.consume(queue, (msg) => msg && received.push(JSON.parse(msg.content.toString())), {
  noAck: true,
});

const running = await startService(
  config,
  createLogger('test', () => {}),
);
const url = `http://127.0.0.1:${running.port}`;

const db = new pg.Pool({ connectionString: config.databaseUrl });

afterAll(async () => {
  await running.stop();
  await amqp.close();
  await db.end();
});

const eventually = async (check: () => boolean, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!check() && Date.now() < deadline) await sleep(100);
  return check();
};

const entrar = (id: string, tipoDeCota: string) =>
  fetch(`${url}/entrada`, {
    method: 'POST',
    headers: { 'x-user-id': id, 'content-type': 'application/json' },
    body: JSON.stringify({ tipoDeCota }),
  });
const joined = (id: string) =>
  received.filter(
    (e) => (e as { payload: { participantId: string } }).payload.participantId === id,
  );

it('publishes Participante entrou once and refuses entering while participando', async () => {
  const id = randomUUID();

  expect((await entrar(id, 'so-cafe')).status).toBe(204);
  expect((await entrar(id, 'completa')).status).toBe(409);

  expect(await eventually(() => joined(id).length > 0)).toBe(true);
  await sleep(1000);
  expect(joined(id)).toMatchObject([{ type: 'participation.participant-joined', version: 1 }]);
});

it('publishes Participante entrou again when the participante returns', async () => {
  const id = randomUUID();

  expect((await entrar(id, 'so-cafe')).status).toBe(204);
  // shortcut: leaves straight in the database until Pedir saída exists.
  await db.query('update participantes set participando = false where id = $1', [id]);
  expect((await entrar(id, 'completa')).status).toBe(204);

  expect(await eventually(() => joined(id).length === 2)).toBe(true);
  const { rows } = await db.query('select tipo_de_cota from participantes where id = $1', [id]);
  expect(rows).toEqual([{ tipo_de_cota: 'completa' }]);
});
