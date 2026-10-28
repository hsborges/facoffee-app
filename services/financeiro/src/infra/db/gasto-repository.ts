import { desc, eq, isNotNull } from 'drizzle-orm';
import type { BuscarGastos, Gastos } from '../../application/gastos.js';
import { fail, ok } from '../../domain/result.js';
import type { Executor } from './database.js';
import { gastos, participantes, reembolsos } from './schema.js';

/** {@link BuscarGastos} on PostgreSQL. */
export const buscarGastos =
  (db: Executor): BuscarGastos =>
  () =>
    // ponytail: every gasto at once, paginate if the list gets long
    db
      .select({
        id: gastos.id,
        participanteId: gastos.participanteId,
        valorEmCentavos: gastos.valorEmCentavos,
        origem: gastos.origem,
        tipo: gastos.tipo,
        notaId: gastos.notaId,
        registradoEm: gastos.registradoEm,
        reembolsado: isNotNull(reembolsos.id).mapWith(Boolean),
      })
      .from(gastos)
      .leftJoin(reembolsos, eq(reembolsos.gastoId, gastos.id))
      .orderBy(desc(gastos.registradoEm), desc(gastos.id));

/** {@link Gastos} on PostgreSQL. */
export const gastoRepository = (db: Executor): Gastos => ({
  // The unique nota_id makes a repeated gasto save nothing.
  salvar: (gasto) =>
    db.transaction(async (tx) => {
      const [conhecido] = await tx
        .select({ id: participantes.id })
        .from(participantes)
        .where(eq(participantes.id, gasto.participanteId));
      if (!conhecido) return fail('nunca-participou' as const);
      const saved = await tx
        .insert(gastos)
        .values(gasto)
        .onConflictDoNothing({ target: gastos.notaId })
        .returning({ id: gastos.id });
      return saved.length === 0 ? fail('nota-ja-usada' as const) : ok(undefined);
    }),
});
