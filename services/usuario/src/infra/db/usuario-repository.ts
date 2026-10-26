import { and, arrayContains, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Repository } from '../../application/usuarios.js';
import { enqueue } from '../outbox.js';
import type { Executor } from './database.js';
import { usuarios, usuariosDesativados } from './schema.js';

/** {@link Repository} on PostgreSQL; `salvar` inserts the desativação and enqueues its events at once. */
export const usuarioRepository = (db: Executor): Repository => ({
  estaDesativado: async (id) => {
    const [row] = await db
      .select({ id: usuariosDesativados.id })
      .from(usuariosDesativados)
      .where(eq(usuariosDesativados.id, id));
    return row !== undefined;
  },
  // A concurrent desativação of the same usuário inserts nothing and publishes nothing.
  salvar: (desativacao, events) =>
    db.transaction(async (tx) => {
      const inserted = await tx
        .insert(usuariosDesativados)
        .values(desativacao)
        .onConflictDoNothing()
        .returning({ id: usuariosDesativados.id });
      if (inserted.length > 0) await enqueue(tx, events);
    }),
  // Runs on every request: the where skips the row write when nothing changed.
  registrar: async ({ id, nome, email, perfis }) => {
    await db
      .insert(usuarios)
      .values({ id, nome, email, perfis: [...perfis] })
      .onConflictDoUpdate({
        target: usuarios.id,
        set: { nome, email, perfis: [...perfis] },
        setWhere: sql`(${usuarios.nome}, ${usuarios.email}, ${usuarios.perfis}) is distinct from (excluded.nome, excluded.email, excluded.perfis)`,
      });
  },
  // shortcut: no pagination, the copa has a few dozen usuários; paginate if it grows to thousands.
  listar: () =>
    db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        desativado: isNotNull(usuariosDesativados.id).mapWith(Boolean),
      })
      .from(usuarios)
      .leftJoin(usuariosDesativados, eq(usuariosDesativados.id, usuarios.id))
      .orderBy(asc(usuarios.nome), asc(usuarios.id)),
  buscar: async (id) => {
    const [row] = await db
      .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email })
      .from(usuarios)
      .where(eq(usuarios.id, id));
    return row;
  },
  gestores: () =>
    db
      .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email })
      .from(usuarios)
      .leftJoin(usuariosDesativados, eq(usuariosDesativados.id, usuarios.id))
      .where(and(arrayContains(usuarios.perfis, ['gestor']), isNull(usuariosDesativados.id)))
      .orderBy(asc(usuarios.nome), asc(usuarios.id)),
  reativar: async (id) => {
    await db.delete(usuariosDesativados).where(eq(usuariosDesativados.id, id));
  },
});
