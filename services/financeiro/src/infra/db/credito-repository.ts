import { asc, desc, eq, sql, sum } from 'drizzle-orm';
import type { BuscarDevido, BuscarTotais } from '../../application/credito.js';
import type { Executor } from './database.js';
import { complementos, cotas, pagamentos, partes, participantes } from './schema.js';

/**
 * {@link BuscarTotais} on PostgreSQL: sums cotas, partes de complementos and pagamentos per
 * participante, by id.
 */
export const buscarTotais =
  (db: Executor): BuscarTotais =>
  (id) => {
    // Summed apart: joining them directly would repeat rows in every sum.
    const devido = db
      .select({
        participanteId: cotas.participanteId,
        total: sum(cotas.valorEmCentavos).as('devido_total'),
      })
      .from(cotas)
      .groupBy(cotas.participanteId)
      .as('devido');
    const partesDevidas = db
      .select({
        participanteId: partes.participanteId,
        total: sum(partes.valorEmCentavos).as('partes_total'),
      })
      .from(partes)
      .groupBy(partes.participanteId)
      .as('partes_devidas');
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
        devidoEmCentavos:
          sql`coalesce(${devido.total}, 0) + coalesce(${partesDevidas.total}, 0)`.mapWith(Number),
        pagoEmCentavos: sql`coalesce(${pago.total}, 0)`.mapWith(Number),
      })
      .from(participantes)
      .leftJoin(devido, eq(devido.participanteId, participantes.id))
      .leftJoin(partesDevidas, eq(partesDevidas.participanteId, participantes.id))
      .leftJoin(pago, eq(pago.participanteId, participantes.id))
      .where(id === undefined ? undefined : eq(participantes.id, id))
      .orderBy(asc(participantes.id));
  };

/** {@link BuscarDevido} on PostgreSQL, newest first. */
export const buscarDevido =
  (db: Executor): BuscarDevido =>
  async (id) => {
    const [cotasDevidas, complementosDevidos] = await Promise.all([
      db
        .select({
          mes: cotas.mes,
          tipoDeCota: cotas.tipoDeCota,
          valorEmCentavos: cotas.valorEmCentavos,
        })
        .from(cotas)
        .where(eq(cotas.participanteId, id))
        .orderBy(desc(cotas.mes)),
      db
        .select({
          id: complementos.id,
          solicitadoEm: complementos.solicitadoEm,
          parteEmCentavos: partes.valorEmCentavos,
        })
        .from(partes)
        .innerJoin(complementos, eq(complementos.id, partes.complementoId))
        .where(eq(partes.participanteId, id))
        .orderBy(desc(complementos.solicitadoEm)),
    ]);
    return { cotas: cotasDevidas, complementos: complementosDevidos };
  };
