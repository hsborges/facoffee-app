import { asc, eq, sql, sum } from 'drizzle-orm';
import type { BuscarTotais } from '../../application/credito.js';
import type { Executor } from './database.js';
import { cotas, pagamentos, participantes } from './schema.js';

/** {@link BuscarTotais} on PostgreSQL: sums cotas and pagamentos per participante, by id. */
export const buscarTotais =
  (db: Executor): BuscarTotais =>
  (id) => {
    // Summed apart: joining cotas and pagamentos directly would repeat rows in both sums.
    const devido = db
      .select({
        participanteId: cotas.participanteId,
        total: sum(cotas.valorEmCentavos).as('devido_total'),
      })
      .from(cotas)
      .groupBy(cotas.participanteId)
      .as('devido');
    const pago = db
      .select({
        participanteId: pagamentos.participanteId,
        total: sum(pagamentos.valorEmCentavos).as('pago_total'),
      })
      .from(pagamentos)
      .groupBy(pagamentos.participanteId)
      .as('pago');
    return db
      .select({
        id: participantes.id,
        ativo: participantes.ativo,
        devidoEmCentavos: sql`coalesce(${devido.total}, 0)`.mapWith(Number),
        pagoEmCentavos: sql`coalesce(${pago.total}, 0)`.mapWith(Number),
      })
      .from(participantes)
      .leftJoin(devido, eq(devido.participanteId, participantes.id))
      .leftJoin(pago, eq(pago.participanteId, participantes.id))
      .where(id === undefined ? undefined : eq(participantes.id, id))
      .orderBy(asc(participantes.id));
  };
