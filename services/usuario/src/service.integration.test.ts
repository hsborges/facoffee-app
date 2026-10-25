// Needs the local compose: cd infra && docker compose up -d --wait postgres rabbitmq
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import amqplib from 'amqplib';
import { afterAll, expect, it, vi } from 'vitest';
import { createLogger } from './infra/logger.js';
import { EXCHANGE } from './infra/rabbitmq.js';
import { startService } from './service.js';

const config = {
  service: 'user',
  port: 0,
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://usuario:usuario@localhost:5432/usuario',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://facoffee:facoffee@localhost:5672',
};
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const amqp = await amqplib.connect(config.rabbitmqUrl);
const channel = await amqp.createChannel();
await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
const { queue } = await channel.assertQueue('', { exclusive: true });
await channel.bindQueue(queue, EXCHANGE, 'user.user-deactivated.v1');
const received: unknown[] = [];
await channel.consume(queue, (msg) => msg && received.push(JSON.parse(msg.content.toString())), {
  noAck: true,
});

const running = await startService(
  config,
  createLogger('test', () => {}),
);
const url = `http://127.0.0.1:${running.port}`;

afterAll(async () => {
  await running.stop();
  await amqp.close();
});

const eventually = async (check: () => boolean, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!check() && Date.now() < deadline) await sleep(100);
  return check();
};

it('publishes Usuário desativado once and blocks the access', async () => {
  const id = randomUUID();
  const desativar = () =>
    fetch(`${url}/${id}/desativar`, {
      method: 'POST',
      headers: { 'x-user-id': id, 'x-user-roles': 'participante' },
    });
  const acesso = () => fetch(`${url}/acesso`, { headers: { 'x-user-id': id } });

  expect((await acesso()).status).toBe(204);
  expect((await desativar()).status).toBe(204);
  expect((await desativar()).status).toBe(204);
  expect((await acesso()).status).toBe(403);

  const mine = () =>
    received.filter((e) => (e as { payload: { userId: string } }).payload.userId === id);
  expect(await eventually(() => mine().length > 0)).toBe(true);
  await sleep(1000);
  expect(mine()).toMatchObject([{ type: 'user.user-deactivated', version: 1 }]);
});

it('registers the usuário on the first access and the gestor reactivates them', async () => {
  const id = randomUUID();
  const gestor = { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' };
  const acesso = (nome: string) =>
    fetch(`${url}/acesso`, {
      headers: { 'x-user-id': id, 'x-user-name': encodeURIComponent(nome), 'x-user-email': '' },
    });
  const listar = async () =>
    ((await (await fetch(`${url}/`, { headers: gestor })).json()) as { id: string }[]).find(
      (u) => u.id === id,
    );
  const post = (acao: string, headers: Record<string, string>) =>
    fetch(`${url}/${id}/${acao}`, { method: 'POST', headers });

  expect(await listar()).toBeUndefined();
  expect((await acesso('João')).status).toBe(204);
  expect((await acesso('João Café')).status).toBe(204);
  expect(await listar()).toEqual({ id, nome: 'João Café', email: '', desativado: false });

  expect((await post('desativar', gestor)).status).toBe(204);
  expect((await acesso('João Café')).status).toBe(403);
  expect(await listar()).toMatchObject({ desativado: true });

  expect((await post('reativar', { 'x-user-id': id, 'x-user-roles': 'participante' })).status).toBe(
    403,
  );
  expect((await post('reativar', gestor)).status).toBe(204);
  expect((await acesso('João Café')).status).toBe(204);
  expect(await listar()).toMatchObject({ desativado: false });
});
