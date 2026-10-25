import { eq } from 'drizzle-orm';
import type { Gastos } from '../../application/gastos.js';
import { fail, ok } from '../../domain/result.js';
import type { Executor } from './database.js';
import { gastos, participantes } from './schema.js';

/** {@link Gastos} on PostgreSQL. */
export const gastoRepository = (db: Executor): Gastos => ({
  // The unique nota_id makes a repeated gasto save nothing.
  salvar: (gasto) =>
    db.transaction(async (tx) => {
      const [conhecido] = await tx
        .select({ id: participantes.id })
        .from(participantes)
        .where(eq(participantes.id, gasto.participanteId));
      if (!conhecido) return fail('participante-nao-encontrado' as const);
      const saved = await tx
        .insert(gastos)
        .values(gasto)
        .onConflictDoNothing({ target: gastos.notaId })
        .returning({ id: gastos.id });
      return saved.length === 0 ? fail('nota-ja-usada' as const) : ok(undefined);
    }),
});
