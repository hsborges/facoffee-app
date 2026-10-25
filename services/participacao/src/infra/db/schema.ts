import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { TipoDeCota } from '../../domain/participante.js';

const instant = (name: string) => timestamp(name, { withTimezone: true });

/**
 * Everyone who ever entered; whoever left keeps the row, with `participando` false.
 * `troca_*` hold a pending troca de tipo de cota, both null when there is none.
 */
export const participantes = pgTable('participantes', {
  id: uuid('id').primaryKey(),
  tipoDeCota: text('tipo_de_cota').$type<TipoDeCota>().notNull(),
  participando: boolean('participando').notNull(),
  trocaTipoDeCota: text('troca_tipo_de_cota').$type<TipoDeCota>(),
  trocaAPartirDe: text('troca_a_partir_de'),
});

/** The valor of each tipo de cota per year; the primary key keeps it defined once. */
export const valoresDaCota = pgTable(
  'valores_da_cota',
  {
    tipoDeCota: text('tipo_de_cota').$type<TipoDeCota>().notNull(),
    ano: integer('ano').notNull(),
    valorEmCentavos: integer('valor_em_centavos').notNull(),
  },
  (t) => [primaryKey({ columns: [t.tipoDeCota, t.ano] })],
);

/** Events written in the aggregate's transaction; the relay publishes them in `seq` order. */
export const outbox = pgTable('outbox', {
  seq: bigint('seq', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  id: uuid('id').notNull().unique(),
  routingKey: text('routing_key').notNull(),
  event: jsonb('event').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
  publishedAt: instant('published_at'),
});

/** Ids of events already handled by the consumer (idempotency). */
export const processedEvents = pgTable('processed_events', {
  id: uuid('id').primaryKey(),
  processedAt: instant('processed_at').notNull().defaultNow(),
});
