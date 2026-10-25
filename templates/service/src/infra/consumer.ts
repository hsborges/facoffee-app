import { setTimeout as sleep } from 'node:timers/promises';
import type { AmqpConnectionManager } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import type { Event } from '../domain/event.js';
import { fail, ok, type Result } from '../domain/result.js';
import type { Executor } from './db/database.js';
import { processedEvents } from './db/schema.js';
import type { Logger } from './logger.js';
import { EXCHANGE } from './rabbitmq.js';

// Throw to fail: the transaction is rolled back and the event is retried.
export type Handler = (event: Event, tx: Executor) => Promise<void>;
export type Handlers = Readonly<Record<string, Handler>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Checks only the envelope; the payload is validated by the handler.
export const parseEvent = (content: Buffer): Result<Event, string> => {
  try {
    const e = JSON.parse(content.toString('utf8'));
    const valid =
      typeof e === 'object' &&
      e !== null &&
      typeof e.id === 'string' &&
      UUID.test(e.id) &&
      typeof e.tipo === 'string' &&
      Number.isInteger(e.versao) &&
      typeof e.ocorridoEm === 'string' &&
      typeof e.payload === 'object' &&
      e.payload !== null;
    return valid ? ok(e) : fail('invalid envelope');
  } catch {
    return fail('invalid JSON');
  }
};

export const retry = async <T>(
  action: () => Promise<T>,
  attempts: number,
  delayMs: (attempt: number) => number,
  onFailure: (error: unknown, attempt: number) => void,
  attempt = 1,
): Promise<Result<T, unknown>> => {
  try {
    return ok(await action());
  } catch (error) {
    onFailure(error, attempt);
    if (attempt >= attempts) return fail(error);
    await sleep(delayMs(attempt));
    return retry(action, attempts, delayMs, onFailure, attempt + 1);
  }
};

// Records the id and handles the event in one transaction: a redelivery does nothing.
const handleOnce = (db: Executor, event: Event, handler: Handler) =>
  db.transaction(async (tx) => {
    const inserted = await tx
      .insert(processedEvents)
      .values({ id: event.id })
      .onConflictDoNothing()
      .returning({ id: processedEvents.id });
    if (inserted.length === 0) return 'duplicate' as const;
    await handler(event, tx);
    return 'processed' as const;
  });

// Queue names follow ADR 0004 (`<context>.eventos`).
export const queues = (service: string) => ({
  events: `${service}.eventos`,
  deadLetter: `${service}.eventos.mortas`,
});

export type ConsumerOptions = {
  readonly connection: AmqpConnectionManager;
  readonly db: Executor;
  readonly service: string;
  readonly handlers: Handlers;
  readonly logger: Logger;
  readonly attempts?: number;
  readonly delayMs?: (attempt: number) => number;
};

// Prefetch 1 keeps events in order.
export const startConsumer = ({
  connection,
  db,
  service,
  handlers,
  logger,
  attempts = 5,
  delayMs = (attempt) => 1000 * 2 ** (attempt - 1),
}: ConsumerOptions) => {
  const queue = queues(service);
  const channel = connection.createChannel({
    setup: async (ch: ConfirmChannel) => {
      await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
      await ch.assertQueue(queue.deadLetter, {
        durable: true,
        arguments: { 'x-queue-type': 'quorum' },
      });
      await ch.assertQueue(queue.events, {
        durable: true,
        arguments: {
          'x-queue-type': 'quorum',
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': queue.deadLetter,
        },
      });
      await Promise.all(
        Object.keys(handlers).map((rk) => ch.bindQueue(queue.events, EXCHANGE, rk)),
      );
    },
  });

  const deadLetter = (msg: ConsumeMessage, reason: string, fields?: Record<string, unknown>) => {
    logger.error('event sent to dead-letter queue', {
      reason,
      routingKey: msg.fields.routingKey,
      messageId: msg.properties.messageId,
      ...fields,
    });
    channel.nack(msg, false, false);
  };

  const onMessage = async (msg: ConsumeMessage) => {
    const { routingKey } = msg.fields;
    const handler = handlers[routingKey];
    if (!handler) {
      logger.warn('ignored event without handler', { routingKey });
      return channel.ack(msg);
    }
    const parsed = parseEvent(msg.content);
    if (!parsed.ok) return deadLetter(msg, parsed.error);
    const event = parsed.value;
    const result = await retry(
      () => handleOnce(db, event, handler),
      attempts,
      delayMs,
      (error, attempt) =>
        logger.warn('failed to handle event', { eventId: event.id, attempt, error }),
    );
    if (!result.ok)
      return deadLetter(msg, 'attempts exhausted', { eventId: event.id, error: result.error });
    logger.info(`event ${result.value}`, { eventId: event.id, routingKey });
    channel.ack(msg);
  };

  channel
    .consume(
      queue.events,
      (msg) => {
        onMessage(msg).catch((error) => logger.error('failed to receive event', { error }));
      },
      { prefetch: 1 },
    )
    .catch((error) => logger.error('failed to start consuming', { error }));

  // `ready` resolves once the queues and bindings exist.
  return { ready: () => channel.waitForConnect(), close: () => channel.close() };
};
