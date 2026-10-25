import { and, eq, notExists } from 'drizzle-orm';
import type { Cotas } from '../../application/cotas.js';
import { enqueue } from '../outbox.js';
import type { Executor } from './database.js';
import { paraParticipante } from './participante-repository.js';
import { cotasDevidas, participantes } from './schema.js';

/** {@link Cotas} on PostgreSQL; `salvar` saves the cota and enqueues its events at once. */
export const cotaRepository = (db: Executor): Cotas => ({
  participandoSemCota: async (mes) => {
    const rows = await db
      .select()
      .from(participantes)
      .where(
        and(
          eq(participantes.participando, true),
          notExists(
            db
              .select()
              .from(cotasDevidas)
              .where(
                and(eq(cotasDevidas.participanteId, participantes.id), eq(cotasDevidas.mes, mes)),
              ),
          ),
        ),
      );
    return rows.map(paraParticipante);
  },
  // The primary key makes a concurrent trigger of the same month save and publish nothing.
  salvar: (cota, events) =>
    db.transaction(async (tx) => {
      const saved = await tx
        .insert(cotasDevidas)
        .values(cota)
        .onConflictDoNothing()
        .returning({ mes: cotasDevidas.mes });
      if (saved.length === 0) return false;
      await enqueue(tx, events);
      return true;
    }),
});
