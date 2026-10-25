import { setTimeout as sleep } from 'node:timers/promises';
import { inArray, isNull } from 'drizzle-orm';
import type { Event } from '../domain/event.js';
import type { Executor } from './db/database.js';
import { outbox } from './db/schema.js';
import type { Logger } from './logger.js';
import { routingKey } from './rabbitmq.js';

export type Publish = (routingKey: string, event: unknown) => Promise<void>;
type Pending = { readonly id: string; readonly routingKey: string; readonly event: unknown };

// Called inside the transaction that writes the aggregate.
export const enqueue = async (tx: Executor, events: readonly Event[]): Promise<void> => {
  if (events.length === 0) return;
  await tx
    .insert(outbox)
    .values(events.map((event) => ({ id: event.id, routingKey: routingKey(event), event })));
};

// Stops at the first error: publishing the next one first would break event order.
export const publishInOrder = async (
  pending: readonly Pending[],
  publish: Publish,
): Promise<{ readonly published: readonly string[]; readonly error?: unknown }> => {
  const [first, ...rest] = pending;
  if (!first) return { published: [] };
  try {
    await publish(first.routingKey, first.event);
  } catch (error) {
    return { published: [], error };
  }
  const next = await publishInOrder(rest, publish);
  return { ...next, published: [first.id, ...next.published] };
};

// `for update` without skip locked: two instances take turns instead of publishing out of order.
export const publishPending = (db: Executor, publish: Publish, batchSize = 100) =>
  db.transaction(async (tx) => {
    const pending = await tx
      .select({ id: outbox.id, routingKey: outbox.routingKey, event: outbox.event })
      .from(outbox)
      .where(isNull(outbox.publishedAt))
      .orderBy(outbox.seq)
      .limit(batchSize)
      .for('update');
    const result = await publishInOrder(pending, publish);
    if (result.published.length > 0) {
      await tx
        .update(outbox)
        .set({ publishedAt: new Date() })
        .where(inArray(outbox.id, [...result.published]));
    }
    return result;
  });

// shortcut: published rows stay in the table forever; purge by age once volume matters.
export const startRelay = (db: Executor, publish: Publish, logger: Logger, intervalMs = 500) => {
  const controller = new AbortController();
  const loop = async (): Promise<void> => {
    while (!controller.signal.aborted) {
      try {
        const { published, error } = await publishPending(db, publish);
        if (published.length > 0) logger.debug('events published', { count: published.length });
        if (error) logger.warn('failed to publish event; retrying next cycle', { error });
      } catch (error) {
        logger.error('outbox relay failed', { error });
      }
      await sleep(intervalMs, undefined, { signal: controller.signal }).catch(() => {});
    }
  };
  const running = loop();
  return async () => {
    controller.abort();
    await running;
  };
};
