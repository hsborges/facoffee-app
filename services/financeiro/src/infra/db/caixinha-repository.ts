import { type AnyColumn, and, eq, lt, sql } from 'drizzle-orm';
import type { BuscarCaixinha } from '../../application/caixinha.js';
import { FUSO } from '../../domain/caixinha.js';
import type { Executor } from './database.js';
import { gastos, pagamentos, reembolsos } from './schema.js';

const total = (valor: AnyColumn) => sql`coalesce(sum(${valor}), 0)`.mapWith(Number);

const noPeriodo = (instante: AnyColumn, ano: number, periodo: 'antes' | 'no-ano') => {
  const anoDoInstante = sql`extract(year from ${instante} at time zone ${FUSO})`;
  return periodo === 'antes' ? lt(anoDoInstante, ano) : eq(anoDoInstante, ano);
};

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
  gastosDoAno: (ano) =>
    db
      .select({ tipo: gastos.tipo, valorEmCentavos: total(gastos.valorEmCentavos) })
      .from(gastos)
      .where(sql`extract(year from ${gastos.registradoEm} at time zone ${FUSO}) = ${ano}`)
      .groupBy(gastos.tipo),
  movimento: async (ano, periodo) => {
    const [[recebido], pelaCaixinha, reembolsados] = await Promise.all([
      db
        .select({ total: total(pagamentos.valorEmCentavos) })
        .from(pagamentos)
        .where(noPeriodo(pagamentos.recebidoEm, ano, periodo)),
      db
        .select({ tipo: gastos.tipo, valorEmCentavos: total(gastos.valorEmCentavos) })
        .from(gastos)
        .where(and(eq(gastos.origem, 'caixinha'), noPeriodo(gastos.registradoEm, ano, periodo)))
        .groupBy(gastos.tipo),
      db
        .select({ tipo: gastos.tipo, valorEmCentavos: total(gastos.valorEmCentavos) })
        .from(reembolsos)
        .innerJoin(gastos, eq(gastos.id, reembolsos.gastoId))
        .where(noPeriodo(reembolsos.feitoEm, ano, periodo))
        .groupBy(gastos.tipo),
    ]);
    return { recebidoEmCentavos: recebido?.total ?? 0, saidas: [...pelaCaixinha, ...reembolsados] };
  },
});
