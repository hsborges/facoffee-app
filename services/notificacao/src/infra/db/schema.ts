import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import type { TipoDeLembrete } from '../../domain/lembrete.js';

const instant = (name: string) => timestamp(name, { withTimezone: true });

/**
 * E-mails to send, written in the transaction that handles the event, or that registers the
 * lembrete, whose id goes in `evento_id`. A failed send stays here
 * and is tried again at `proxima_tentativa_em`; `enviado_em` marks the ones sent and
 * `recusado_em` the ones whose recipient the SMTP server refused for good.
 */
export const emails = pgTable('emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventoId: uuid('evento_id').notNull(),
  para: text('para').notNull(),
  assunto: text('assunto').notNull(),
  texto: text('texto').notNull(),
  tentativas: integer('tentativas').notNull().default(0),
  proximaTentativaEm: instant('proxima_tentativa_em').notNull().defaultNow(),
  enviadoEm: instant('enviado_em'),
  recusadoEm: instant('recusado_em'),
});

/** Lembretes registered; the unique key keeps one per participante, month (`AAAA-MM`) and tipo. */
export const lembretes = pgTable(
  'lembretes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participanteId: uuid('participante_id').notNull(),
    mes: text('mes').notNull(),
    tipo: text('tipo').$type<TipoDeLembrete>().notNull(),
    registradoEm: instant('registrado_em').notNull().defaultNow(),
  },
  (t) => [unique().on(t.participanteId, t.mes, t.tipo)],
);

/** Ids of events already handled by the consumer (idempotency). */
export const processedEvents = pgTable('processed_events', {
  id: uuid('id').primaryKey(),
  processedAt: instant('processed_at').notNull().defaultNow(),
});
