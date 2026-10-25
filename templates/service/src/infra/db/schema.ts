import { bigint, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const instant = (name: string) => timestamp(name, { withTimezone: true });

export const examples = pgTable('examples', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  registeredAt: instant('registered_at').notNull(),
  confirmedAt: instant('confirmed_at'),
});

// Events written in the aggregate's transaction; the relay publishes them in `seq` order.
export const outbox = pgTable('outbox', {
  seq: bigint('seq', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  id: uuid('id').notNull().unique(),
  routingKey: text('routing_key').notNull(),
  event: jsonb('event').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
  publishedAt: instant('published_at'),
});

// Ids of events already handled by the consumer (idempotency).
export const processedEvents = pgTable('processed_events', {
  id: uuid('id').primaryKey(),
  processedAt: instant('processed_at').notNull().defaultNow(),
});
