import { type AnyColumn, and, eq, lt, sql } from 'drizzle-orm';
import type { BuscarCaixinha } from '../../application/caixinha.js';
import { FUSO, type Mes } from '../../domain/caixinha.js';
import type { Executor } from './database.js';
import { gastos, pagamentos, reembolsos } from './schema.js';

const total = (valor: AnyColumn) => sql`coalesce(sum(${valor}), 0)`.mapWith(Number);

// `AAAA-MM` compares as text, so `antes` is every month before `mes`.
const noPeriodo = (instante: AnyColumn, mes: Mes, periodo: 'antes' | 'no-mes') => {
  const mesDoInstante = sql`to_char(${instante} at time zone ${FUSO}, 'YYYY-MM')`;
  return periodo === 'antes' ? lt(mesDoInstante, mes) : eq(mesDoInstante, mes);
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
      .where(sql`extract(year from ${gastos.feitoEm} at time zone ${FUSO}) = ${ano}`)
      .groupBy(gastos.tipo),
  movimento: async (mes, periodo) => {
    const [[recebido], pelaCaixinha, reembolsados] = await Promise.all([
      db
        .select({ total: total(pagamentos.valorEmCentavos) })
        .from(pagamentos)
        .where(noPeriodo(pagamentos.recebidoEm, mes, periodo)),
      db
        .select({ tipo: gastos.tipo, valorEmCentavos: total(gastos.valorEmCentavos) })
        .from(gastos)
        .where(and(eq(gastos.origem, 'caixinha'), noPeriodo(gastos.feitoEm, mes, periodo)))
        .groupBy(gastos.tipo),
      db
        .select({ tipo: gastos.tipo, valorEmCentavos: total(gastos.valorEmCentavos) })
        .from(reembolsos)
        .innerJoin(gastos, eq(gastos.id, reembolsos.gastoId))
        .where(noPeriodo(reembolsos.feitoEm, mes, periodo))
        .groupBy(gastos.tipo),
    ]);
    return { recebidoEmCentavos: recebido?.total ?? 0, saidas: [...pelaCaixinha, ...reembolsados] };
  },
});
