// Needs the local compose: cd infra && docker compose up -d --wait postgres rabbitmq
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import amqplib from 'amqplib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startConsumer } from './infra/consumer.js';
import { connectDatabase } from './infra/db/database.js';
import { createLogger } from './infra/logger.js';
import { connectRabbitmq, EXCHANGE } from './infra/rabbitmq.js';
import { startService } from './service.js';

const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://example:example@localhost:5432/example',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://facoffee:facoffee@localhost:5672',
};
const logger = createLogger('test', () => {});
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });
// Unique names so the test does not compete with a running example container.
const service = `test-${randomUUID().slice(0, 8)}`;

const eventually = async <T>(
  check: () => Promise<T | undefined>,
  timeoutMs = 10_000,
): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value !== undefined) return value;
    await sleep(100);
  }
  throw new Error('condition not met in time');
};

const amqp = await amqplib.connect(config.rabbitmqUrl);
const channel = await amqp.createChannel();
const publishRaw = (rk: string, content: unknown) =>
  channel.publish(
    EXCHANGE,
    rk,
    Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)),
  );
const envelope = (type: string) => ({
  id: randomUUID(),
  type,
  version: 1,
  occurredAt: new Date().toISOString(),
  payload: {},
});

afterAll(async () => {
  for (const queue of [`${service}.events`, `${service}.events.dead-letter`])
    await channel.deleteQueue(queue);
  await amqp.close();
});

describe('consumer', () => {
  const handled: string[] = [];
  const database = connectDatabase(config.databaseUrl);
  const connection = connectRabbitmq(config.rabbitmqUrl, logger);
  const consumer = database.then(({ db }) =>
    startConsumer({
      connection,
      db,
      service,
      logger,
      attempts: 2,
      delayMs: () => 10,
      handlers: {
        'test.ok.v1': async (event) => {
          handled.push(event.id);
        },
        'test.always-fails.v1': async () => {
          throw new Error('boom');
        },
      },
    }),
  );

  beforeAll(async () => {
    await (await consumer).ready();
  });

  afterAll(async () => {
    await (await consumer).close();
    await connection.close();
    await (await database).close();
  });

  it('handles a redelivered event only once', async () => {
    const event = envelope('test.ok');
    publishRaw('test.ok.v1', event);
    publishRaw('test.ok.v1', event);
    const marker = envelope('test.ok');
    publishRaw('test.ok.v1', marker);

    await eventually(async () => (handled.includes(marker.id) ? true : undefined));
    expect(handled.filter((id) => id === event.id)).toHaveLength(1);
  });

  it('sends to the dead-letter queue after the attempts and invalid messages right away', async () => {
    publishRaw('test.always-fails.v1', envelope('test.always-fails'));
    publishRaw('test.ok.v1', '{not json');

    const dead = await eventually(async () => {
      const { messageCount } = await channel.checkQueue(`${service}.events.dead-letter`);
      return messageCount >= 2 ? messageCount : undefined;
    });
    expect(dead).toBe(2);
  });
});

describe('service', () => {
  it('publishes Example registered through the outbox and consumes it', async () => {
    const running = await startService({ ...config, service: `${service}-svc`, port: 0 }, logger);
    try {
      const url = `http://127.0.0.1:${running.port}`;
      const created = await fetch(`${url}/examples`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Coffee' }),
      }).then((r) => r.json());

      const confirmed = await eventually(async () => {
        const example = await fetch(`${url}/examples/${created.id}`).then((r) => r.json());
        return example.confirmedAt ? example : undefined;
      });
      expect(confirmed.name).toBe('Coffee');
    } finally {
      await running.stop();
      for (const queue of [`${service}-svc.events`, `${service}-svc.events.dead-letter`])
        await channel.deleteQueue(queue);
    }
  });
});
