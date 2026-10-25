import { type AnyColumn, eq, sql } from 'drizzle-orm';
import type { BuscarCaixinha } from '../../application/caixinha.js';
import { FUSO } from '../../domain/caixinha.js';
import type { Executor } from './database.js';
import { gastos, pagamentos, reembolsos } from './schema.js';

const total = (valor: AnyColumn) => sql`coalesce(sum(${valor}), 0)`.mapWith(Number);

/** {@link BuscarCaixinha} on PostgreSQL. */
export const caixinhaRepository = (db: Executor): BuscarCaixinha => ({
  totais: async () => {
    const [[recebido], porOrigem, [reembolsado]] = await Promise.all([
      db.select({ total: total(pagamentos.valorEmCentavos) }).from(pagamentos),
      db
        .select({ origem: gastos.origem, valorEmCentavos: total(gastos.valorEmCentavos) })
        .from(gastos)
        .groupBy(gastos.origem),
      db
        .select({ total: total(gastos.valorEmCentavos) })
        .from(reembolsos)
        .innerJoin(gastos, eq(gastos.id, reembolsos.gastoId)),
    ]);
    return {
      recebidoEmCentavos: recebido?.total ?? 0,
      gastos: porOrigem,
      reembolsadoEmCentavos: reembolsado?.total ?? 0,
    };
  },
  gastosDoAno: async (ano) => {
    const [soma] = await db
      .select({ total: total(gastos.valorEmCentavos) })
      .from(gastos)
      .where(sql`extract(year from ${gastos.feitoEm} at time zone ${FUSO}) = ${ano}`);
    return soma?.total ?? 0;
  },
});
