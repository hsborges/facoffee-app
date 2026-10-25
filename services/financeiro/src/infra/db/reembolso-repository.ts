import { eq } from 'drizzle-orm';
import type { Reembolsos } from '../../application/reembolsos.js';
import { fail, ok } from '../../domain/result.js';
import { enqueue } from '../outbox.js';
import type { Executor } from './database.js';
import { gastos, reembolsos } from './schema.js';

/** {@link Reembolsos} on PostgreSQL; `salvar` saves the reembolso and enqueues its events at once. */
export const reembolsoRepository = (db: Executor): Reembolsos => ({
  buscarGasto: async (id) => {
    const [gasto] = await db.select().from(gastos).where(eq(gastos.id, id));
    return gasto;
  },
  // The unique gasto_id makes a second reembolso, even a concurrent one, save and publish nothing.
  salvar: (reembolso, events) =>
    db.transaction(async (tx) => {
      const saved = await tx
        .insert(reembolsos)
        .values(reembolso)
        .onConflictDoNothing({ target: reembolsos.gastoId })
        .returning({ id: reembolsos.id });
      if (saved.length === 0) return fail('gasto-ja-reembolsado' as const);
      await enqueue(tx, events);
      return ok(undefined);
    }),
});
