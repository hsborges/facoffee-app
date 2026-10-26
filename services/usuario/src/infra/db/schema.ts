import { sql } from 'drizzle-orm';
import { bigint, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { Perfil } from '../../domain/usuario.js';

const instant = (name: string) => timestamp(name, { withTimezone: true });

/**
 * Usuários registered on their first access; nome, email and perfis follow the Passaporte UFMS as
 * of the latest access (ADR 0012, 0031).
 */
export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull(),
  perfis: text('perfis').array().$type<Perfil[]>().notNull().default(sql`'{}'`),
});

/** Deactivated accesses; the gateway refuses every request from these ids (ADR 0011). */
export const usuariosDesativados = pgTable('usuarios_desativados', {
  id: uuid('id').primaryKey(),
  desativadoEm: instant('desativado_em').notNull(),
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
