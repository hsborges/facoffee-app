import { and, eq } from 'drizzle-orm';
import type { ValoresDaCota } from '../../application/tipos-de-cota.js';
import { enqueue } from '../outbox.js';
import type { Executor } from './database.js';
import { valoresDaCota } from './schema.js';

/** {@link ValoresDaCota} on PostgreSQL; `salvar` saves the valor and enqueues its events at once. */
export const valorDaCotaRepository = (db: Executor): ValoresDaCota => ({
  buscar: async (tipoDeCota, ano) => {
    const [row] = await db
      .select()
      .from(valoresDaCota)
      .where(and(eq(valoresDaCota.tipoDeCota, tipoDeCota), eq(valoresDaCota.ano, ano)));
    return row;
  },
  // The primary key makes a concurrent definition of the same valor save and publish nothing.
  salvar: (valor, events) =>
    db.transaction(async (tx) => {
      const saved = await tx
        .insert(valoresDaCota)
        .values(valor)
        .onConflictDoNothing()
        .returning({ ano: valoresDaCota.ano });
      if (saved.length === 0) return false;
      await enqueue(tx, events);
      return true;
    }),
});
