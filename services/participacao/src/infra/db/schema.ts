import { bigint, boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { TipoDeCota } from '../../domain/participante.js';

const instant = (name: string) => timestamp(name, { withTimezone: true });

/** Everyone who ever entered; whoever left keeps the row, with `participando` false. */
export const participantes = pgTable('participantes', {
  id: uuid('id').primaryKey(),
  tipoDeCota: text('tipo_de_cota').$type<TipoDeCota>().notNull(),
  participando: boolean('participando').notNull(),
});

/** Events written in the aggregate's transaction; the relay publishes them in `seq` order. */
export const outbox = pgTable('outbox', {
  seq: bigint('seq', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  id: uuid('id').notNull().unique(),
  routingKey: text('routing_key').notNull(),
  event: jsonb('event').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
  publishedAt: instant('published_at'),
});
