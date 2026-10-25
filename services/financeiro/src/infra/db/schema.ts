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
import type { Forma } from '../../domain/pagamento.js';
import type { TipoDeCota } from '../../domain/participante.js';

const instant = (name: string) => timestamp(name, { withTimezone: true });

/** Everyone Participação told about; whoever left keeps the row, with `ativo` false. */
export const participantes = pgTable('participantes', {
  id: uuid('id').primaryKey(),
  ativo: boolean('ativo').notNull(),
});

/** Cotas devidas; the primary key keeps one cota per participante and month (`AAAA-MM`). */
export const cotas = pgTable(
  'cotas',
  {
    participanteId: uuid('participante_id')
      .notNull()
      .references(() => participantes.id),
    mes: text('mes').notNull(),
    tipoDeCota: text('tipo_de_cota').$type<TipoDeCota>().notNull(),
    valorEmCentavos: integer('valor_em_centavos').notNull(),
  },
  (t) => [primaryKey({ columns: [t.participanteId, t.mes] })],
);

/** Pagamentos recebidos; a comprovante belongs to one pagamento only. */
export const pagamentos = pgTable('pagamentos', {
  id: uuid('id').primaryKey(),
  participanteId: uuid('participante_id')
    .notNull()
    .references(() => participantes.id),
  valorEmCentavos: integer('valor_em_centavos').notNull(),
  forma: text('forma').$type<Forma>().notNull(),
  comprovanteId: uuid('comprovante_id').unique(),
  recebidoEm: instant('recebido_em').notNull(),
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

/** Ids of events already handled by the consumer (idempotency). */
export const processedEvents = pgTable('processed_events', {
  id: uuid('id').primaryKey(),
  processedAt: instant('processed_at').notNull().defaultNow(),
});
