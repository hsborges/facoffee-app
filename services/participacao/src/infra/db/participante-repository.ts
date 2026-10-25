import { eq } from 'drizzle-orm';
import type { Repository } from '../../application/participantes.js';
import { enqueue } from '../outbox.js';
import type { Executor } from './database.js';
import { participantes } from './schema.js';

/** {@link Repository} on PostgreSQL; `salvarEntrada` saves the participante and enqueues its events at once. */
export const participanteRepository = (db: Executor): Repository => ({
  buscar: async (id) => {
    const [row] = await db.select().from(participantes).where(eq(participantes.id, id));
    return row;
  },
  // The setWhere makes a concurrent entrada of the same person save and publish nothing.
  salvarEntrada: (participante, events) =>
    db.transaction(async (tx) => {
      const saved = await tx
        .insert(participantes)
        .values(participante)
        .onConflictDoUpdate({
          target: participantes.id,
          set: { tipoDeCota: participante.tipoDeCota, participando: true },
          setWhere: eq(participantes.participando, false),
        })
        .returning({ id: participantes.id });
      if (saved.length === 0) return false;
      await enqueue(tx, events);
      return true;
    }),
});
