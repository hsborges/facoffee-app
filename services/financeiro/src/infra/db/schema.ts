import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Analise } from '../../domain/comprovante-enviado.js';
import type { Origem, TipoDeGasto } from '../../domain/gasto.js';
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

/**
 * Comprovantes the participantes enviaram; an arquivo is sent once only, and a comprovante
 * cancelado is deleted. `valor_confirmado_em_centavos` is set only when confirmado, `motivo` only
 * when recusado, as the `analise` check enforces.
 */
export const comprovantesEnviados = pgTable(
  'comprovantes_enviados',
  {
    id: uuid('id').primaryKey(),
    participanteId: uuid('participante_id')
      .notNull()
      .references(() => participantes.id),
    comprovanteId: uuid('comprovante_id').notNull().unique(),
    valorEmCentavos: integer('valor_em_centavos').notNull(),
    enviadoEm: instant('enviado_em').notNull(),
    situacao: text('situacao').$type<Analise['situacao']>().notNull(),
    valorConfirmadoEmCentavos: integer('valor_confirmado_em_centavos'),
    motivo: text('motivo'),
  },
  (t) => [
    check(
      'analise',
      sql`(${t.situacao} = 'a-confirmar' and ${t.valorConfirmadoEmCentavos} is null and ${t.motivo} is null)
        or (${t.situacao} = 'confirmado' and ${t.valorConfirmadoEmCentavos} is not null and ${t.motivo} is null)
        or (${t.situacao} = 'recusado' and ${t.motivo} is not null and ${t.valorConfirmadoEmCentavos} is null)`,
    ),
  ],
);

/** Gastos feitos; a nota belongs to one gasto only. */
export const gastos = pgTable('gastos', {
  id: uuid('id').primaryKey(),
  participanteId: uuid('participante_id')
    .notNull()
    .references(() => participantes.id),
  valorEmCentavos: integer('valor_em_centavos').notNull(),
  origem: text('origem').$type<Origem>().notNull(),
  tipo: text('tipo').$type<TipoDeGasto>().notNull(),
  notaId: uuid('nota_id').notNull().unique(),
  feitoEm: instant('feito_em').notNull(),
});

/** Reembolsos feitos; the unique gasto_id keeps a gasto from being reembolsado twice. */
export const reembolsos = pgTable('reembolsos', {
  id: uuid('id').primaryKey(),
  gastoId: uuid('gasto_id')
    .notNull()
    .unique()
    .references(() => gastos.id),
  feitoEm: instant('feito_em').notNull(),
});

/** Complementos solicitados. */
export const complementos = pgTable('complementos', {
  id: uuid('id').primaryKey(),
  valorTotalEmCentavos: integer('valor_total_em_centavos').notNull(),
  solicitadoEm: instant('solicitado_em').notNull(),
});

/** Partes de complementos devidas; one per participante ativo at the solicitação. */
export const partes = pgTable(
  'partes',
  {
    complementoId: uuid('complemento_id')
      .notNull()
      .references(() => complementos.id),
    participanteId: uuid('participante_id')
      .notNull()
      .references(() => participantes.id),
    valorEmCentavos: integer('valor_em_centavos').notNull(),
  },
  (t) => [primaryKey({ columns: [t.complementoId, t.participanteId] })],
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
