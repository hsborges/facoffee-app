import { eq } from 'drizzle-orm';
import type { Repository } from '../../application/usuarios.js';
import { enqueue } from '../outbox.js';
import type { Executor } from './database.js';
import { usuariosDesativados } from './schema.js';

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
});
