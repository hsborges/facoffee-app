import { asc, eq, sql } from 'drizzle-orm';
import type { Repository } from '../../application/participantes.js';
import type { Executor } from './database.js';
import { cotas, participantes } from './schema.js';

/**
 * {@link Repository} on PostgreSQL. `salvar` upserts the participante and inserts only the cotas
 * not saved yet, so a cota devida never changes.
 */
export const participanteRepository = (db: Executor): Repository => ({
  buscar: async (id) => {
    // Handlers read, change and save: the lock serializes them per participante until the
    // transaction ends, so one never overwrites what another saved in between.
    await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
    const [row] = await db.select().from(participantes).where(eq(participantes.id, id));
    if (!row) return undefined;
    const devidas = await db
      .select({
        mes: cotas.mes,
        tipoDeCota: cotas.tipoDeCota,
        valorEmCentavos: cotas.valorEmCentavos,
      })
      .from(cotas)
      .where(eq(cotas.participanteId, id))
      .orderBy(asc(cotas.mes));
    return { ...row, cotas: devidas };
  },
  salvar: ({ id, ativo, cotas: devidas }) =>
    db.transaction(async (tx) => {
      await tx
        .insert(participantes)
        .values({ id, ativo })
        .onConflictDoUpdate({ target: participantes.id, set: { ativo } });
      if (devidas.length === 0) return;
      await tx
        .insert(cotas)
        .values(devidas.map((cota) => ({ participanteId: id, ...cota })))
        .onConflictDoNothing();
    }),
  ativos: async () => {
    const rows = await db
      .select({ id: participantes.id })
      .from(participantes)
      .where(eq(participantes.ativo, true))
      .orderBy(asc(participantes.id));
    return rows.map((row) => row.id);
  },
});
